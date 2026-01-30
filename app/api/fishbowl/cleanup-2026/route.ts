import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting cleanup of 2026 Fishbowl data...');
    
    const stats = {
      ordersDeleted: 0,
      itemsDeleted: 0,
      historyDeleted: 0,
      customersUpdated: 0
    };

    // Delete all sales orders from 2026
    const ordersSnapshot = await adminDb
      .collection('fishbowl_sales_orders')
      .where('commissionYear', '==', 2026)
      .get();
    
    console.log(`📦 Found ${ordersSnapshot.size} orders from 2026`);
    
    let batch = adminDb.batch();
    let batchCount = 0;
    
    for (const doc of ordersSnapshot.docs) {
      batch.delete(doc.ref);
      batchCount++;
      stats.ordersDeleted++;
      
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`✅ Deleted batch of ${batchCount} orders`);
        batch = adminDb.batch();
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Deleted final batch of ${batchCount} orders`);
    }

    // Delete all line items from 2026
    const itemsSnapshot = await adminDb
      .collection('fishbowl_soitems')
      .where('commissionYear', '==', 2026)
      .get();
    
    console.log(`📦 Found ${itemsSnapshot.size} line items from 2026`);
    
    batch = adminDb.batch();
    batchCount = 0;
    
    for (const doc of itemsSnapshot.docs) {
      batch.delete(doc.ref);
      batchCount++;
      stats.itemsDeleted++;
      
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`✅ Deleted batch of ${batchCount} line items`);
        batch = adminDb.batch();
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Deleted final batch of ${batchCount} line items`);
    }

    // Delete sales order history from customer subcollections
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    
    console.log(`👥 Checking ${customersSnapshot.size} customers for 2026 order history...`);
    
    for (const customerDoc of customersSnapshot.docs) {
      const historySnapshot = await customerDoc.ref
        .collection('sales_order_history')
        .where('commissionYear', '==', 2026)
        .get();
      
      if (historySnapshot.size > 0) {
        batch = adminDb.batch();
        batchCount = 0;
        
        for (const historyDoc of historySnapshot.docs) {
          batch.delete(historyDoc.ref);
          batchCount++;
          stats.historyDeleted++;
          
          if (batchCount >= 500) {
            await batch.commit();
            batch = adminDb.batch();
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
        }
        
        stats.customersUpdated++;
      }
    }

    console.log('✅ Cleanup complete!');
    console.log(`   Orders deleted: ${stats.ordersDeleted}`);
    console.log(`   Line items deleted: ${stats.itemsDeleted}`);
    console.log(`   History entries deleted: ${stats.historyDeleted}`);
    console.log(`   Customers updated: ${stats.customersUpdated}`);

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error: any) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
