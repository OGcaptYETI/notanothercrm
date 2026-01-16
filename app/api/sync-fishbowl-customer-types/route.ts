import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Sync account types from Copper to Fishbowl customers
 * Updates fishbowl_customers with correct account types from copper_companies
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🔄 Starting Fishbowl customer account type sync from Copper...');
    
    // Load all Fishbowl customers
    const fishbowlCustomersSnap = await adminDb.collection('fishbowl_customers').get();
    console.log(`📦 Loaded ${fishbowlCustomersSnap.size} Fishbowl customers`);
    
    // Load all Copper companies
    const copperCompaniesSnap = await adminDb.collection('copper_companies').get();
    console.log(`📦 Loaded ${copperCompaniesSnap.size} Copper companies`);
    
    // Build Copper lookup maps - by ID (primary) and by name (fallback)
    const copperByIdMap = new Map();
    const copperByNameMap = new Map();
    
    copperCompaniesSnap.forEach(doc => {
      const data = doc.data();
      const copperId = doc.id;
      const name = (data.name || '').toLowerCase().trim();
      const isActive = data['Active Customer cf_712751'] === true;
      const fishbowlCustomerId = data['Account ID cf_713477'] || data['Account Order ID cf_698467'];
      
      // Normalize account type
      let accountType = 'Retail';
      const copperAccountTypeRaw = data['Account Type cf_675914'];
      
      if (Array.isArray(copperAccountTypeRaw) && copperAccountTypeRaw.length > 0) {
        const typeId = copperAccountTypeRaw[0];
        if (typeId === 2063862 || typeId === '2063862') accountType = 'Wholesale';
        else if (typeId === 1981470 || typeId === '1981470') accountType = 'Distributor';
        else if (typeId === 2066840 || typeId === '2066840') accountType = 'Retail';
      } else if (typeof copperAccountTypeRaw === 'string') {
        accountType = copperAccountTypeRaw;
      }
      
      const copperData = {
        accountType,
        copperId,
        name: data.name,
        isActive,
        fishbowlCustomerId
      };
      
      // Map by Fishbowl Customer ID (from Account Order ID field) - MOST RELIABLE
      if (fishbowlCustomerId) {
        copperByIdMap.set(String(fishbowlCustomerId), copperData);
      }
      
      // Also map by Copper ID as fallback
      copperByIdMap.set(copperId, copperData);
      
      // Map by name (for final fallback matching)
      if (name) {
        copperByNameMap.set(name, copperData);
      }
    });
    
    console.log(`📋 Built Copper lookup maps:`);
    console.log(`   By ID: ${copperByIdMap.size} companies`);
    console.log(`   By Name: ${copperByNameMap.size} companies`);
    
    // Update Fishbowl customers
    let matchedById = 0;
    let matchedByName = 0;
    let notMatched = 0;
    let updated = 0;
    
    const batch = adminDb.batch();
    let batchCount = 0;
    const batchSize = 500;
    
    for (const doc of fishbowlCustomersSnap.docs) {
      const customer = doc.data();
      const accountId = customer.accountId || customer.customerId;
      const customerName = (customer.name || customer.customerName || '').toLowerCase().trim();
      
      // Try to match by Account ID first (most reliable)
      let copperData = accountId ? copperByIdMap.get(String(accountId)) : null;
      
      if (copperData) {
        matchedById++;
      } else if (customerName) {
        // Fallback to name matching
        copperData = copperByNameMap.get(customerName);
        if (copperData) {
          matchedByName++;
        }
      }
      
      if (copperData) {
        // Only update if account type changed
        if (customer.accountType !== copperData.accountType) {
          batch.update(doc.ref, {
            accountType: copperData.accountType,
            accountTypeSource: 'copper',
            copperId: copperData.copperId,
            updatedAt: new Date()
          });
          
          updated++;
          batchCount++;
          
          console.log(`✅ ${customerName}: ${customer.accountType} → ${copperData.accountType}`);
          
          // Commit batch if it reaches batch size
          if (batchCount >= batchSize) {
            await batch.commit();
            console.log(`   Committed batch of ${batchCount} updates`);
            batchCount = 0;
          }
        }
      } else {
        notMatched++;
        console.log(`⚠️  No Copper match: ${customerName}`);
      }
    }
    
    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   Committed final batch of ${batchCount} updates`);
    }
    
    const totalMatched = matchedById + matchedByName;
    
    console.log('\n✅ Sync complete!');
    console.log(`   Matched by ID: ${matchedById}`);
    console.log(`   Matched by Name: ${matchedByName}`);
    console.log(`   Total Matched: ${totalMatched}`);
    console.log(`   Not matched: ${notMatched}`);
    console.log(`   Updated: ${updated}`);
    
    return NextResponse.json({
      success: true,
      matchedById,
      matchedByName,
      totalMatched,
      notMatched,
      updated
    });
    
  } catch (error: any) {
    console.error('❌ Error syncing customer types:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
