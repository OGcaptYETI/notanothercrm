import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking order data availability...\n');

    // Check a few specific customers that showed "No orders found"
    const testCustomers = [
      { name: "Mr. Rock & Roll | AK", accountNumber: "1461" },
      { name: "Creating Better Days", accountNumber: "48" },
      { name: "MBI Distro", accountNumber: "433" },
    ];

    const results: any[] = [];

    for (const testCustomer of testCustomers) {
      console.log(`\n📊 Checking: ${testCustomer.name} (Account #${testCustomer.accountNumber})`);
      
      // Find the fishbowl_customer by accountNumber
      const customerQuery = await adminDb
        .collection('fishbowl_customers')
        .where('accountNumber', '==', testCustomer.accountNumber)
        .limit(1)
        .get();

      if (customerQuery.empty) {
        console.log(`  ❌ No fishbowl_customer found with accountNumber: ${testCustomer.accountNumber}`);
        results.push({
          name: testCustomer.name,
          accountNumber: testCustomer.accountNumber,
          found: false,
          reason: 'No fishbowl_customer found'
        });
        continue;
      }

      const customerDoc = customerQuery.docs[0];
      const customerId = customerDoc.id;
      const customerData = customerDoc.data();

      console.log(`  ✅ Found fishbowl_customer: ${customerData.name}`);
      console.log(`     - doc.id: ${customerId}`);
      console.log(`     - accountNumber: ${customerData.accountNumber}`);
      console.log(`     - accountId: ${customerData.accountId}`);

      // Check for orders using this customerId
      const ordersQuery = await adminDb
        .collection('fishbowl_sales_orders')
        .where('customerId', '==', customerId)
        .limit(5)
        .get();

      console.log(`     - Orders found: ${ordersQuery.size}`);

      if (!ordersQuery.empty) {
        const sampleOrder = ordersQuery.docs[0].data();
        console.log(`     - Sample order: ${sampleOrder.soNum} - ${sampleOrder.postingDate?.toDate?.()}`);
      }

      // Also check by accountNumber directly in orders
      const ordersByAccountNumber = await adminDb
        .collection('fishbowl_sales_orders')
        .where('accountNumber', '==', testCustomer.accountNumber)
        .limit(5)
        .get();

      console.log(`     - Orders by accountNumber: ${ordersByAccountNumber.size}`);

      results.push({
        name: testCustomer.name,
        accountNumber: testCustomer.accountNumber,
        found: true,
        customerId: customerId,
        customerName: customerData.name,
        ordersByCustomerId: ordersQuery.size,
        ordersByAccountNumber: ordersByAccountNumber.size,
        sampleOrder: ordersQuery.empty ? null : {
          soNum: ordersQuery.docs[0].data().soNum,
          date: ordersQuery.docs[0].data().postingDate?.toDate?.()?.toISOString(),
        }
      });
    }

    // Also check total orders in the system
    const totalOrdersSnapshot = await adminDb
      .collection('fishbowl_sales_orders')
      .limit(1)
      .get();

    console.log(`\n📊 Total orders in fishbowl_sales_orders: checking...`);

    return NextResponse.json({
      success: true,
      testResults: results,
      hasOrders: !totalOrdersSnapshot.empty,
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
