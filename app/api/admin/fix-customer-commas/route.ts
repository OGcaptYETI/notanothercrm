import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Strip commas from customer IDs across all collections
 * Fixes: "1,001" → "1001"
 */
export async function POST() {
  try {
    console.log('\n🔧 STARTING COMMA CLEANUP OPERATION');
    console.log('=' .repeat(80));
    
    const stats = {
      fishbowlCustomersFixed: 0,
      fishbowlCustomersChecked: 0,
      copperCompaniesFixed: 0,
      copperCompaniesChecked: 0,
      errors: [] as string[]
    };

    // 1. FIX FISHBOWL_CUSTOMERS COLLECTION
    console.log('\n📦 Phase 1: Cleaning fishbowl_customers collection...');
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    stats.fishbowlCustomersChecked = customersSnapshot.size;
    
    const customerBatch = adminDb.batch();
    let customerBatchCount = 0;

    for (const doc of customersSnapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      
      // Check if document ID has comma
      const hasCommaInId = docId.includes(',');
      
      // Check if accountId or accountNumber fields have commas
      const accountId = data.accountId ? String(data.accountId) : null;
      const accountNumber = data.accountNumber ? String(data.accountNumber) : null;
      
      const hasCommaInAccountId = accountId?.includes(',');
      const hasCommaInAccountNumber = accountNumber?.includes(',');
      
      if (hasCommaInId || hasCommaInAccountId || hasCommaInAccountNumber) {
        const cleanedDocId = docId.replace(/,/g, '');
        const cleanedAccountId = accountId?.replace(/,/g, '');
        const cleanedAccountNumber = accountNumber?.replace(/,/g, '');
        
        console.log(`  🔧 Fixing customer: ${docId}`);
        if (hasCommaInAccountId) console.log(`     accountId: "${accountId}" → "${cleanedAccountId}"`);
        if (hasCommaInAccountNumber) console.log(`     accountNumber: "${accountNumber}" → "${cleanedAccountNumber}"`);
        
        // If document ID has comma, need to create new doc and delete old
        if (hasCommaInId && cleanedDocId !== docId) {
          console.log(`     Document ID: "${docId}" → "${cleanedDocId}"`);
          
          // Create new document with cleaned ID
          const newDocRef = adminDb.collection('fishbowl_customers').doc(cleanedDocId);
          const updateData = { ...data };
          
          if (hasCommaInAccountId && cleanedAccountId) updateData.accountId = cleanedAccountId;
          if (hasCommaInAccountNumber && cleanedAccountNumber) updateData.accountNumber = cleanedAccountNumber;
          
          customerBatch.set(newDocRef, updateData);
          customerBatch.delete(doc.ref);
          
          stats.fishbowlCustomersFixed++;
          customerBatchCount += 2;
        } else {
          // Just update fields
          const updates: any = {};
          if (hasCommaInAccountId && cleanedAccountId) updates.accountId = cleanedAccountId;
          if (hasCommaInAccountNumber && cleanedAccountNumber) updates.accountNumber = cleanedAccountNumber;
          
          if (Object.keys(updates).length > 0) {
            customerBatch.update(doc.ref, updates);
            stats.fishbowlCustomersFixed++;
            customerBatchCount++;
          }
        }
        
        // Commit batch every 400 operations
        if (customerBatchCount >= 400) {
          await customerBatch.commit();
          console.log(`  ✅ Committed batch (${customerBatchCount} operations)`);
          customerBatchCount = 0;
        }
      }
    }
    
    // Final commit for fishbowl_customers
    if (customerBatchCount > 0) {
      await customerBatch.commit();
      console.log(`  ✅ Final commit (${customerBatchCount} operations)`);
    }
    
    console.log(`✅ fishbowl_customers: Fixed ${stats.fishbowlCustomersFixed} of ${stats.fishbowlCustomersChecked} customers\n`);

    // 2. FIX COPPER_COMPANIES COLLECTION
    console.log('🏢 Phase 2: Cleaning copper_companies Account IDs...');
    const copperSnapshot = await adminDb.collection('copper_companies').get();
    stats.copperCompaniesChecked = copperSnapshot.size;
    
    const copperBatch = adminDb.batch();
    let copperBatchCount = 0;

    for (const doc of copperSnapshot.docs) {
      const data = doc.data();
      
      // Check Account ID cf_713477 field
      const accountId = data.cf_713477;
      if (accountId && String(accountId).includes(',')) {
        const cleanedAccountId = String(accountId).replace(/,/g, '');
        
        console.log(`  🔧 Fixing: ${data.name || doc.id}`);
        console.log(`     Account ID: "${accountId}" → "${cleanedAccountId}"`);
        
        copperBatch.update(doc.ref, {
          cf_713477: cleanedAccountId
        });
        
        stats.copperCompaniesFixed++;
        copperBatchCount++;
        
        // Commit batch every 400 operations
        if (copperBatchCount >= 400) {
          await copperBatch.commit();
          console.log(`  ✅ Committed batch (${copperBatchCount} operations)`);
          copperBatchCount = 0;
        }
      }
    }
    
    // Final commit for copper_companies
    if (copperBatchCount > 0) {
      await copperBatch.commit();
      console.log(`  ✅ Final commit (${copperBatchCount} operations)`);
    }
    
    console.log(`✅ copper_companies: Fixed ${stats.copperCompaniesFixed} of ${stats.copperCompaniesChecked} companies\n`);

    // 3. FIX CUSTOMER_SALES_SUMMARY COLLECTION
    console.log('📊 Phase 3: Cleaning customer_sales_summary collection...');
    const salesSummarySnapshot = await adminDb.collection('customer_sales_summary').get();
    const salesSummaryChecked = salesSummarySnapshot.size;
    let salesSummaryFixed = 0;
    
    const salesSummaryBatch = adminDb.batch();
    let salesSummaryBatchCount = 0;

    for (const doc of salesSummarySnapshot.docs) {
      const docId = doc.id;
      const data = doc.data();
      
      // Check if document ID has comma
      if (docId.includes(',')) {
        const cleanedDocId = docId.replace(/,/g, '');
        
        console.log(`  🔧 Fixing sales summary: ${docId} → ${cleanedDocId}`);
        
        // Update customerId field too
        const updateData = { ...data, customerId: cleanedDocId };
        
        // Create new document with cleaned ID
        const newDocRef = adminDb.collection('customer_sales_summary').doc(cleanedDocId);
        salesSummaryBatch.set(newDocRef, updateData);
        salesSummaryBatch.delete(doc.ref);
        
        salesSummaryFixed++;
        salesSummaryBatchCount += 2;
        
        // Commit batch every 400 operations
        if (salesSummaryBatchCount >= 400) {
          await salesSummaryBatch.commit();
          console.log(`  ✅ Committed batch (${salesSummaryBatchCount} operations)`);
          salesSummaryBatchCount = 0;
        }
      }
    }
    
    // Final commit for customer_sales_summary
    if (salesSummaryBatchCount > 0) {
      await salesSummaryBatch.commit();
      console.log(`  ✅ Final commit (${salesSummaryBatchCount} operations)`);
    }
    
    console.log(`✅ customer_sales_summary: Fixed ${salesSummaryFixed} of ${salesSummaryChecked} summaries\n`);

    // SUMMARY
    console.log('\n' + '='.repeat(80));
    console.log('✅ COMMA CLEANUP COMPLETE');
    console.log('='.repeat(80));
    console.log(`fishbowl_customers:      ${stats.fishbowlCustomersFixed} fixed / ${stats.fishbowlCustomersChecked} checked`);
    console.log(`copper_companies:        ${stats.copperCompaniesFixed} fixed / ${stats.copperCompaniesChecked} checked`);
    console.log(`customer_sales_summary:  ${salesSummaryFixed} fixed / ${salesSummaryChecked} checked`);
    console.log('='.repeat(80) + '\n');

    return NextResponse.json({
      success: true,
      stats,
      message: `Fixed ${stats.fishbowlCustomersFixed + stats.copperCompaniesFixed} records with commas`
    });

  } catch (error: any) {
    console.error('❌ Comma cleanup error:', error);
    return NextResponse.json(
      { error: error.message || 'Cleanup failed' },
      { status: 500 }
    );
  }
}
