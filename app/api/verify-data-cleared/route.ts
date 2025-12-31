import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('\n🔍 VERIFYING DATA CLEARED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const results: Record<string, any> = {};
    
    // Check main collections
    const collections = [
      'fishbowl_sales_orders',
      'fishbowl_soitems',
      'monthly_commissions',
      'commission_entries',
      'import_summary_reports'
    ];
    
    for (const collectionName of collections) {
      const count = await adminDb.collection(collectionName).count().get();
      results[collectionName] = count.data().count;
      console.log(`📦 ${collectionName}: ${count.data().count} documents`);
    }
    
    // Check subcollections in fishbowl_customers
    console.log('\n📦 Checking fishbowl_customers subcollections...');
    const customers = await adminDb.collection('fishbowl_customers').limit(10).get();
    let totalSubcollectionDocs = 0;
    
    for (const customerDoc of customers.docs) {
      const salesOrderHistory = await customerDoc.ref.collection('sales_order_history').count().get();
      totalSubcollectionDocs += salesOrderHistory.data().count;
    }
    
    results['sales_order_history_sample'] = totalSubcollectionDocs;
    console.log(`📦 sales_order_history (sample of 10 customers): ${totalSubcollectionDocs} documents`);
    
    // Determine if cleanup is needed
    const needsCleanup: string[] = [];
    
    if (results.fishbowl_sales_orders > 0) needsCleanup.push('fishbowl_sales_orders');
    if (results.fishbowl_soitems > 0) needsCleanup.push('fishbowl_soitems');
    if (results.sales_order_history_sample > 0) needsCleanup.push('sales_order_history subcollections');
    if (results.monthly_commissions > 0) needsCleanup.push('monthly_commissions (old calculation data)');
    if (results.commission_entries > 0) needsCleanup.push('commission_entries (old calculation data)');
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (needsCleanup.length === 0) {
      console.log('✅ ALL DATA CLEARED - Ready for fresh import!');
    } else {
      console.log('⚠️  CLEANUP NEEDED:');
      needsCleanup.forEach(item => console.log(`   - ${item}`));
    }
    
    return NextResponse.json({
      success: true,
      allCleared: needsCleanup.length === 0,
      counts: results,
      needsCleanup,
      recommendation: needsCleanup.length === 0 
        ? 'Ready for fresh import' 
        : 'Run deletion endpoint again or clear additional collections'
    });
    
  } catch (error: any) {
    console.error('❌ Verification error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
