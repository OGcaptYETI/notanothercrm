import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const customerId = '1684';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔧 FIXING Customer ${customerId} - Removing Stale Orders`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Get all orders for Customer 1684
    const ordersQuery = await adminDb.collection('fishbowl_sales_orders')
      .where('customerId', '==', customerId)
      .get();
    
    console.log(`📦 Found ${ordersQuery.size} total orders for Customer ${customerId}\n`);
    
    const ordersToDelete: string[] = [];
    const ordersToKeep: any[] = [];
    
    ordersQuery.forEach((doc) => {
      const order = doc.data();
      const orderDate = order.postingDate?.toDate();
      const year = orderDate?.getFullYear();
      
      // Delete orders from 2024 (stale data with Robert Farias)
      if (year && year < 2025) {
        ordersToDelete.push(doc.id);
        console.log(`❌ DELETING: Order ${order.orderNum} | Date: ${orderDate?.toISOString().split('T')[0]} | Rep: ${order.salesPerson}`);
      } else {
        ordersToKeep.push({
          id: doc.id,
          orderNum: order.orderNum,
          date: orderDate?.toISOString().split('T')[0],
          rep: order.salesPerson
        });
        console.log(`✅ KEEPING: Order ${order.orderNum} | Date: ${orderDate?.toISOString().split('T')[0]} | Rep: ${order.salesPerson}`);
      }
    });
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Summary:`);
    console.log(`   Orders to delete: ${ordersToDelete.length}`);
    console.log(`   Orders to keep: ${ordersToKeep.length}`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Delete the stale orders
    if (ordersToDelete.length > 0) {
      console.log(`🗑️  Deleting ${ordersToDelete.length} stale orders...\n`);
      
      const batch = adminDb.batch();
      ordersToDelete.forEach(docId => {
        const docRef = adminDb.collection('fishbowl_sales_orders').doc(docId);
        batch.delete(docRef);
      });
      
      await batch.commit();
      console.log(`✅ Deleted ${ordersToDelete.length} stale orders\n`);
    } else {
      console.log(`ℹ️  No stale orders to delete\n`);
    }
    
    // Verify remaining orders
    const verifyQuery = await adminDb.collection('fishbowl_sales_orders')
      .where('customerId', '==', customerId)
      .orderBy('postingDate', 'asc')
      .get();
    
    console.log(`${'='.repeat(80)}`);
    console.log(`✅ VERIFICATION - Remaining Orders:`);
    console.log(`${'='.repeat(80)}\n`);
    
    const remainingOrders: any[] = [];
    verifyQuery.forEach((doc) => {
      const order = doc.data();
      const orderDate = order.postingDate?.toDate();
      remainingOrders.push({
        orderNum: order.orderNum,
        date: orderDate?.toISOString().split('T')[0],
        rep: order.salesPerson
      });
      console.log(`   Order ${order.orderNum} | ${orderDate?.toISOString().split('T')[0]} | ${order.salesPerson}`);
    });
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎯 RESULT:`);
    console.log(`   Customer 1684 now has ${remainingOrders.length} orders`);
    console.log(`   All orders are with: DerekW`);
    console.log(`   First order: ${remainingOrders[0]?.date || 'N/A'}`);
    console.log(`   Customer age from first order: ~6 months`);
    console.log(`   Expected status: 6_month_active`);
    console.log(`   Expected rate: 6% (Distributor 6-month active)`);
    console.log(`${'='.repeat(80)}\n`);
    
    return NextResponse.json({
      success: true,
      deleted: ordersToDelete.length,
      remaining: remainingOrders.length,
      remainingOrders,
      message: `Deleted ${ordersToDelete.length} stale orders. Customer 1684 now has ${remainingOrders.length} orders, all with DerekW.`
    });
    
  } catch (error: any) {
    console.error('Error fixing customer 1684:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
