import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get first 5 sales orders to check their structure
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .limit(5)
      .get();
    
    const sampleOrders = ordersSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Log full data for first order
      if (ordersSnapshot.docs[0].id === doc.id) {
        console.log('FULL ORDER DATA:', JSON.stringify(data, null, 2));
      }
      
      return {
        id: doc.id,
        customerId: data.customerId,
        customerName: data.customerName,
        soNumber: data.soNumber,
        salesPerson: data.salesPerson,
        // Check all possible revenue fields
        revenue: data.revenue,
        orderValue: data.orderValue,
        totalPrice: data.totalPrice,
        total: data.total,
        amount: data.amount,
        orderTotal: data.orderTotal,
        // Show first 20 fields
        fieldSample: Object.keys(data).slice(0, 20).reduce((obj: any, key) => {
          obj[key] = data[key];
          return obj;
        }, {})
      };
    });
    
    // Check a few customers
    const customersSnapshot = await adminDb.collection('fishbowl_customers')
      .limit(3)
      .get();
    
    const sampleCustomers = customersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        dataId: data.id,
        customerNum: data.customerNum,
        name: data.name,
        customerName: data.customerName
      };
    });
    
    return NextResponse.json({
      success: true,
      totalOrders: ordersSnapshot.size,
      sampleOrders,
      sampleCustomers,
      message: 'Check which fields contain revenue data'
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
