import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const salesPerson = searchParams.get('salesPerson');

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      );
    }

    console.log(`📊 Fetching commission orders for ${year}-${month}${salesPerson ? ` (${salesPerson})` : ''}`);

    // Query sales_order_history collection
    let query = adminDb
      .collection('sales_order_history')
      .where('commissionYear', '==', parseInt(year))
      .where('commissionMonth', '==', parseInt(month));

    // Add sales person filter if provided
    if (salesPerson && salesPerson !== 'all') {
      query = query.where('salesPerson', '==', salesPerson);
    }

    const snapshot = await query.get();

    console.log(`📦 Found ${snapshot.size} orders in sales_order_history`);

    // Get line items for each order to calculate totals
    const orders = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        // Get line items for this order
        const lineItemsSnapshot = await adminDb
          .collection('sales_order_line_items')
          .where('salesOrderId', '==', data.salesOrderId)
          .get();

        // Calculate total from line items
        let totalPrice = 0;
        const productDetails: string[] = [];

        lineItemsSnapshot.docs.forEach(lineDoc => {
          const lineData = lineDoc.data();
          const itemTotal = (lineData.totalPrice || 0);
          totalPrice += itemTotal;
          
          if (lineData.productNum) {
            productDetails.push(`${lineData.productNum} (${lineData.qtyFulfilled || 0})`);
          }
        });

        return {
          id: doc.id,
          soNumber: data.soNumber || '',
          salesOrderId: data.salesOrderId || '',
          customerName: data.customerName || '',
          salesPerson: data.salesPerson || '',
          postingDate: data.postingDate || data.commissionDate || '',
          totalPrice: totalPrice,
          accountType: data.accountType || 'Unknown',
          excludeFromCommission: data.excludeFromCommission || false,
          commissionNote: data.commissionNote || '',
          productDetails: productDetails.join(', ')
        };
      })
    );

    // Sort by posting date descending
    orders.sort((a, b) => {
      const dateA = new Date(a.postingDate).getTime();
      const dateB = new Date(b.postingDate).getTime();
      return dateB - dateA;
    });

    console.log(`✅ Returning ${orders.length} orders`);
    console.log(`   - Excluded: ${orders.filter(o => o.excludeFromCommission).length}`);
    console.log(`   - Included: ${orders.filter(o => !o.excludeFromCommission).length}`);

    return NextResponse.json({
      success: true,
      orders,
      summary: {
        total: orders.length,
        excluded: orders.filter(o => o.excludeFromCommission).length,
        included: orders.filter(o => !o.excludeFromCommission).length,
        totalValue: orders.reduce((sum, o) => sum + o.totalPrice, 0),
        excludedValue: orders.filter(o => o.excludeFromCommission).reduce((sum, o) => sum + o.totalPrice, 0),
        includedValue: orders.filter(o => !o.excludeFromCommission).reduce((sum, o) => sum + o.totalPrice, 0)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching commission orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
