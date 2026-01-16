import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking sample kit orders for customers with no regular orders...');

    // Get a sample of customers that had "no orders found"
    const testCustomers = [
      'Reign and smoke',
      'The Gas Pipe Smoke Shop',
      'The Herb Shop on Broad -BTG',
      'All in one Wholesale-ED',
      'Alpha Creations- CA',
      'The Kava Den',
      'Smokey Trails Smoke Shop LLC',
      'Ziggy\'s',
      'Shopify Customer'
    ];

    const results = [];

    for (const customerName of testCustomers) {
      // Find customer in fishbowl_customers
      const customerSnapshot = await adminDb
        .collection('fishbowl_customers')
        .where('name', '==', customerName)
        .limit(1)
        .get();

      if (customerSnapshot.empty) {
        results.push({
          customerName,
          found: false,
          message: 'Customer not found in fishbowl_customers'
        });
        continue;
      }

      const customer = customerSnapshot.docs[0].data();
      const accountId = customer.accountId;

      // Check for ANY sales orders (including $0 ones)
      const allOrdersSnapshot = await adminDb
        .collection('fishbowl_so')
        .where('customerName', '==', customerName)
        .get();

      // Check for sample kit items specifically
      const sampleKitSnapshot = await adminDb
        .collection('fishbowl_soitems')
        .where('customerName', '==', customerName)
        .where('productNumber', '==', 'Store Sample Kit')
        .get();

      const allOrders = allOrdersSnapshot.docs.map(doc => ({
        soNum: doc.data().soNum,
        totalPrice: doc.data().totalPrice,
        dateScheduled: doc.data().dateScheduled,
        status: doc.data().status
      }));

      const sampleKits = sampleKitSnapshot.docs.map(doc => ({
        soNum: doc.data().soNum,
        productNumber: doc.data().productNumber,
        productDescription: doc.data().productDescription,
        totalPrice: doc.data().totalPrice,
        dateScheduled: doc.data().dateScheduled
      }));

      results.push({
        customerName,
        accountId,
        found: true,
        totalOrders: allOrders.length,
        sampleKitOrders: sampleKits.length,
        allOrders: allOrders.slice(0, 5), // First 5 orders
        sampleKits: sampleKits.slice(0, 5) // First 5 sample kits
      });
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error: any) {
    console.error('❌ Error checking sample kits:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
