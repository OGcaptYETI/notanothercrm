import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Fix Copper Company IDs in fishbowl_customers
 * 
 * PROBLEM:
 * - fishbowl_customers.copperId sometimes contains Account Order ID instead of Copper Company ID
 * - This causes 404 errors when trying to update Copper via API
 * 
 * SOLUTION:
 * - Look up correct Copper Company ID from copper_companies collection
 * - Update fishbowl_customers with correct copperCompanyId
 * 
 * Usage:
 * POST /api/fix-copper-company-ids
 * Body: { dryRun: true }  // Preview changes without committing
 * Body: { dryRun: false } // Actually apply changes
 */

interface FixResult {
  customerId: string;
  customerName: string;
  accountOrderId: string;
  oldCopperId: any;
  newCopperCompanyId: string | null;
  copperCompanyName?: string;
  action: 'fixed' | 'no_copper_match' | 'already_correct' | 'no_account_order_id';
  notes: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { dryRun = true } = await request.json();
    
    console.log('\n' + '='.repeat(80));
    console.log('🔧 COPPER COMPANY ID FIX SCRIPT');
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '⚠️ LIVE RUN (will update database)'}`);
    console.log('='.repeat(80) + '\n');

    const results: FixResult[] = [];
    let stats = {
      total: 0,
      fixed: 0,
      alreadyCorrect: 0,
      noCopperMatch: 0,
      noAccountOrderId: 0,
      errors: 0
    };

    // Step 1: Load all copper_companies and index by Account Order ID
    console.log('📦 Loading copper_companies collection...');
    const copperCompaniesSnap = await adminDb.collection('copper_companies').get();
    
    const copperByAccountOrderId = new Map<string, any>();
    const copperByCopperId = new Map<string, any>();
    
    copperCompaniesSnap.forEach(doc => {
      const data = doc.data();
      const copperCompanyId = String(doc.id);
      const accountOrderId = data['Account Order ID cf_698467'];
      const accountId = data['Account ID cf_713477'];
      
      // Index by Copper Company ID (the real one)
      copperByCopperId.set(copperCompanyId, { id: copperCompanyId, ...data });
      
      // Index by Account Order ID (for lookup)
      if (accountOrderId) {
        const key = String(accountOrderId).trim();
        copperByAccountOrderId.set(key, { id: copperCompanyId, ...data });
      }
      
      // Also index by Account ID as fallback
      if (accountId) {
        const key = String(accountId).trim();
        if (!copperByAccountOrderId.has(key)) {
          copperByAccountOrderId.set(key, { id: copperCompanyId, ...data });
        }
      }
    });
    
    console.log(`   ✅ Loaded ${copperCompaniesSnap.size} Copper companies`);
    console.log(`   ✅ Indexed ${copperByAccountOrderId.size} by Account Order ID / Account ID`);
    console.log(`   ✅ Indexed ${copperByCopperId.size} by Copper Company ID\n`);

    // Step 2: Load all fishbowl_customers
    console.log('📦 Loading fishbowl_customers collection...');
    const fishbowlCustomersSnap = await adminDb.collection('fishbowl_customers').get();
    console.log(`   ✅ Loaded ${fishbowlCustomersSnap.size} Fishbowl customers\n`);

    // Step 3: Analyze each customer
    console.log('🔍 Analyzing customers...\n');
    
    const batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 450;

    for (const doc of fishbowlCustomersSnap.docs) {
      stats.total++;
      const customer = doc.data();
      const customerId = doc.id; // This is the Account Order ID (Fishbowl customer number)
      const customerName = customer.name || customer.customerName || 'Unknown';
      const currentCopperId = customer.copperId;
      
      const result: FixResult = {
        customerId,
        customerName,
        accountOrderId: customerId,
        oldCopperId: currentCopperId,
        newCopperCompanyId: null,
        action: 'no_account_order_id',
        notes: []
      };

      // The doc.id IS the Account Order ID
      const accountOrderId = customerId;
      
      if (!accountOrderId) {
        result.action = 'no_account_order_id';
        result.notes.push('⚠️ Customer has no Account Order ID (doc.id is empty)');
        stats.noAccountOrderId++;
        results.push(result);
        continue;
      }

      // Look up Copper company by Account Order ID
      const copperCompany = copperByAccountOrderId.get(accountOrderId);
      
      if (!copperCompany) {
        result.action = 'no_copper_match';
        result.notes.push(`⚠️ No Copper company found with Account Order ID: ${accountOrderId}`);
        stats.noCopperMatch++;
        results.push(result);
        continue;
      }

      const correctCopperCompanyId = String(copperCompany.id);
      result.newCopperCompanyId = correctCopperCompanyId;
      result.copperCompanyName = copperCompany.name;

      // Check if already correct
      if (String(currentCopperId) === correctCopperCompanyId) {
        result.action = 'already_correct';
        result.notes.push('✅ Already has correct Copper Company ID');
        stats.alreadyCorrect++;
        results.push(result);
        continue;
      }

      // Needs fixing
      result.action = 'fixed';
      result.notes.push(`🔧 Will update: ${currentCopperId} → ${correctCopperCompanyId}`);
      result.notes.push(`   Copper company: ${copperCompany.name}`);
      stats.fixed++;

      if (!dryRun) {
        // Apply the fix
        batch.update(doc.ref, {
          copperCompanyId: correctCopperCompanyId,
          copperId: correctCopperCompanyId, // Update both for compatibility
          copperCompanyIdFixedAt: new Date()
        });
        batchCount++;

        // Commit batch if needed
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`   💾 Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }

      results.push(result);

      // Log first 20 fixes
      if (stats.fixed <= 20) {
        console.log(`${stats.fixed}. ${customerName} (${customerId})`);
        console.log(`   Old: ${currentCopperId || 'null'}`);
        console.log(`   New: ${correctCopperCompanyId}`);
        console.log(`   Copper: ${copperCompany.name}\n`);
      }
    }

    // Commit final batch
    if (!dryRun && batchCount > 0) {
      await batch.commit();
      console.log(`   💾 Committed final batch of ${batchCount} updates`);
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total customers analyzed: ${stats.total}`);
    console.log(`✅ Already correct: ${stats.alreadyCorrect}`);
    console.log(`🔧 Fixed (or would fix): ${stats.fixed}`);
    console.log(`⚠️  No Copper match: ${stats.noCopperMatch}`);
    console.log(`⚠️  No Account Order ID: ${stats.noAccountOrderId}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log('='.repeat(80) + '\n');

    if (dryRun) {
      console.log('🔍 DRY RUN COMPLETE - No changes were made');
      console.log('💡 To apply changes, send { dryRun: false }\n');
    } else {
      console.log('✅ LIVE RUN COMPLETE - Database updated\n');
    }

    return NextResponse.json({
      success: true,
      dryRun,
      stats,
      results: results.filter(r => r.action === 'fixed' || r.action === 'no_copper_match'),
      message: dryRun 
        ? `Dry run complete. ${stats.fixed} customers would be fixed.`
        : `Fixed ${stats.fixed} customers successfully.`
    });

  } catch (error: any) {
    console.error('❌ Error fixing Copper Company IDs:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
