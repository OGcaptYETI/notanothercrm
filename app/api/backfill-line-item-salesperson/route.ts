import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dryRun = body.dryRun !== false; // Default to dry run
    const targetMonth = body.month || '2026-01'; // Default to January 2026
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 BACKFILL LINE ITEM SALESPERSON ${dryRun ? '🟢 DRY RUN' : '🔴 LIVE MODE'}`);
    console.log(`📅 Target Month: ${targetMonth}`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Load all orders for the target month to build salesOrderId -> salesPerson map
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .where('commissionMonth', '==', targetMonth)
      .get();
    
    console.log(`📦 Loaded ${ordersSnapshot.size} orders for ${targetMonth}`);
    
    const orderSalesPersonMap = new Map<string, string>();
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      if (order.salesOrderId && order.salesPerson) {
        orderSalesPersonMap.set(order.salesOrderId, order.salesPerson);
      }
    });
    
    console.log(`📊 Built map of ${orderSalesPersonMap.size} orders with salesPerson values`);
    
    // Load line items for the target month
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', targetMonth)
      .get();
    
    console.log(`📦 Loaded ${lineItemsSnapshot.size} line items for ${targetMonth}`);
    
    let stats = {
      total: lineItemsSnapshot.size,
      alreadyHasSalesPerson: 0,
      backfilled: 0,
      orderNotFound: 0,
      orderMissingSalesPerson: 0
    };
    
    const samplesToBackfill: any[] = [];
    
    let batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;
    
    for (const doc of lineItemsSnapshot.docs) {
      const item = doc.data();
      const currentSalesPerson = item.salesPerson || '';
      
      // Skip if already has a salesPerson
      if (currentSalesPerson && currentSalesPerson !== '') {
        stats.alreadyHasSalesPerson++;
        continue;
      }
      
      // Look up parent order's salesPerson
      const salesOrderId = item.salesOrderId;
      if (!salesOrderId) {
        stats.orderNotFound++;
        continue;
      }
      
      const orderSalesPerson = orderSalesPersonMap.get(salesOrderId);
      
      if (!orderSalesPerson) {
        stats.orderMissingSalesPerson++;
        if (samplesToBackfill.length < 5) {
          samplesToBackfill.push({
            docId: doc.id,
            soNumber: item.soNumber,
            salesOrderId: item.salesOrderId,
            issue: 'Parent order has no salesPerson'
          });
        }
        continue;
      }
      
      // Backfill the salesPerson
      stats.backfilled++;
      
      if (samplesToBackfill.length < 10) {
        samplesToBackfill.push({
          docId: doc.id,
          soNumber: item.soNumber,
          salesOrderId: item.salesOrderId,
          oldSalesPerson: currentSalesPerson || '(empty)',
          newSalesPerson: orderSalesPerson
        });
      }
      
      if (!dryRun) {
        batch.update(doc.ref, {
          salesPerson: orderSalesPerson,
          backfilledAt: Timestamp.now()
        });
        batchCount++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ Committed batch of ${batchCount} updates`);
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
    }
    
    // Commit final batch
    if (!dryRun && batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} updates`);
    }
    
    console.log('\n📊 BACKFILL STATS:');
    console.log(`   Total Line Items: ${stats.total}`);
    console.log(`   ✅ Already Has SalesPerson: ${stats.alreadyHasSalesPerson}`);
    console.log(`   🔄 Backfilled: ${stats.backfilled}`);
    console.log(`   ⚠️ Order Not Found: ${stats.orderNotFound}`);
    console.log(`   ⚠️ Order Missing SalesPerson: ${stats.orderMissingSalesPerson}\n`);
    
    return NextResponse.json({
      success: true,
      dryRun,
      month: targetMonth,
      stats,
      samples: samplesToBackfill,
      message: dryRun 
        ? `Preview: Would backfill ${stats.backfilled} line items` 
        : `Backfilled ${stats.backfilled} line items successfully`
    });
    
  } catch (error: any) {
    console.error('Backfill error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
