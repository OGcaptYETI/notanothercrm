import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking fishbowl_sales_orders field structure...\n');

    // Get sample orders from fishbowl_sales_orders collection
    const ordersSnapshot = await adminDb
      .collection('fishbowl_sales_orders')
      .limit(10)
      .get();

    console.log(`Found ${ordersSnapshot.size} orders in fishbowl_sales_orders`);

    const sampleOrders: any[] = [];
    ordersSnapshot.docs.forEach(doc => {
      const order = doc.data();
      
      // Extract all possible price-related fields
      const priceFields: any = {};
      Object.keys(order).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('price') || 
            lowerKey.includes('total') || 
            lowerKey.includes('amount') || 
            lowerKey.includes('cost') ||
            lowerKey.includes('value')) {
          priceFields[key] = order[key];
        }
      });

      sampleOrders.push({
        soNum: order.soNum || order.soNumber || doc.id,
        customerId: order.customerId,
        customerName: order.customerName,
        priceFields: priceFields,
        allFields: Object.keys(order),
        sampleData: {
          totalPrice: order.totalPrice,
          orderTotal: order.orderTotal,
          total: order.total,
          grandTotal: order.grandTotal,
          amount: order.amount,
          subtotal: order.subtotal,
        }
      });

      console.log(`\nOrder: ${order.soNum || doc.id}`);
      console.log(`  Customer: ${order.customerName} (${order.customerId})`);
      console.log(`  Price fields found:`, priceFields);
    });

    return NextResponse.json({
      success: true,
      ordersFound: ordersSnapshot.size,
      sampleOrders: sampleOrders,
      summary: {
        message: "Check the priceFields object to see which field contains the order total",
        instruction: "Look for fields like totalPrice, orderTotal, total, grandTotal, etc."
      }
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
