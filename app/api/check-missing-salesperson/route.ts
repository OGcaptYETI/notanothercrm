import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get sample orders and their line items to see the mismatch
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .where('commissionMonth', '==', '2026-01')
      .limit(10)
      .get();
    
    const samples = [];
    
    for (const orderDoc of ordersSnapshot.docs) {
      const order = orderDoc.data();
      
      // Get line items for this order
      const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
        .where('salesOrderId', '==', order.salesOrderId)
        .limit(3)
        .get();
      
      const lineItems = lineItemsSnapshot.docs.map(doc => {
        const item = doc.data();
        return {
          soItemId: item.soItemId,
          productNum: item.productNum,
          salesPerson: item.salesPerson,
          totalPrice: item.totalPrice
        };
      });
      
      samples.push({
        soNumber: order.soNumber,
        salesOrderId: order.salesOrderId,
        orderSalesPerson: order.salesPerson,
        orderSalesRep: order.salesRep,
        lineItems
      });
    }
    
    // Count line items with Unknown vs proper values
    const allLineItems = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', '2026-01')
      .get();
    
    let unknownCount = 0;
    let knownCount = 0;
    let missingCount = 0;
    
    allLineItems.forEach(doc => {
      const item = doc.data();
      if (!item.salesPerson || item.salesPerson === '') {
        missingCount++;
      } else if (item.salesPerson === 'Unknown') {
        unknownCount++;
      } else {
        knownCount++;
      }
    });
    
    return NextResponse.json({
      success: true,
      totalLineItems: allLineItems.size,
      lineItemsWithUnknown: unknownCount,
      lineItemsWithProperRep: knownCount,
      lineItemsMissingSalesPerson: missingCount,
      samples
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
