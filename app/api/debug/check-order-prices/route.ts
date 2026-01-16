import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking order price data...\n');

    // Get multiple customers and find one with orders
    const customerQuery = await adminDb
      .collection('fishbowl_customers')
      .where('accountId', '!=', null)
      .limit(20)
      .get();

    if (customerQuery.empty) {
      return NextResponse.json({ error: 'No customers found' });
    }

    let ordersSnapshot: any = null;
    let customerId = '';
    let customerData: any = null;

    // Try to find a customer with orders
    for (const customerDoc of customerQuery.docs) {
      customerId = customerDoc.id;
      customerData = customerDoc.data();

      const testOrders = await adminDb
        .collection('fishbowl_customers')
        .doc(customerId)
        .collection('sales_order_history')
        .limit(5)
        .get();

      if (!testOrders.empty) {
        ordersSnapshot = testOrders;
        console.log(`✅ Found customer with orders: ${customerData.name} (${customerId})`);
        break;
      }
    }

    if (!ordersSnapshot || ordersSnapshot.empty) {
      return NextResponse.json({ 
        error: 'No customers found with orders in sales_order_history',
        checkedCustomers: customerQuery.size 
      });
    }

    console.log(`\nFound ${ordersSnapshot.size} orders in sales_order_history`);

    const orders: any[] = [];
    ordersSnapshot.docs.forEach(doc => {
      const order = doc.data();
      orders.push({
        soNum: order.soNum || doc.id,
        totalPrice: order.totalPrice,
        orderTotal: order.orderTotal,
        total: order.total,
        amount: order.amount,
        allFields: Object.keys(order),
      });
      
      console.log(`\nOrder: ${order.soNum || doc.id}`);
      console.log(`  - totalPrice: ${order.totalPrice}`);
      console.log(`  - orderTotal: ${order.orderTotal}`);
      console.log(`  - total: ${order.total}`);
      console.log(`  - amount: ${order.amount}`);
      console.log(`  - Available fields: ${Object.keys(order).join(', ')}`);
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: customerId,
        name: customerData.name,
      },
      ordersFound: ordersSnapshot.size,
      sampleOrders: orders,
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
