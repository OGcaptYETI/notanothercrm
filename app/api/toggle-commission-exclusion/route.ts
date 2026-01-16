import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, exclude, month, year } = body;

    if (!orderId || exclude === undefined) {
      return NextResponse.json(
        { error: 'Order ID and exclude flag are required' },
        { status: 400 }
      );
    }

    console.log(`🔄 ${exclude ? 'Excluding' : 'Including'} order ${orderId} from commissions`);

    // Update the order in sales_order_history
    const orderRef = adminDb.collection('sales_order_history').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const orderData = orderDoc.data();
    
    // Update the exclusion flag
    await orderRef.update({
      excludeFromCommission: exclude,
      excludeFromCommissionUpdatedAt: FieldValue.serverTimestamp(),
      excludeFromCommissionUpdatedBy: 'admin' // TODO: Get actual user email from auth
    });

    console.log(`✅ Order ${orderId} ${exclude ? 'excluded from' : 'included in'} commissions`);

    // If we have month and year, recalculate that specific month's commissions
    if (month && year && orderData?.salesPerson) {
      console.log(`🔄 Recalculating commissions for ${orderData.salesPerson} - ${year}-${month}`);
      
      try {
        await recalculateMonthCommissions(
          orderData.salesPerson,
          parseInt(month),
          parseInt(year)
        );
        console.log(`✅ Recalculated commissions for ${orderData.salesPerson}`);
      } catch (recalcError) {
        console.error('⚠️ Error recalculating commissions:', recalcError);
        // Don't fail the whole request if recalc fails
      }
    }

    return NextResponse.json({
      success: true,
      message: exclude ? 'Order excluded from commissions' : 'Order included in commissions',
      recalculated: !!(month && year && orderData?.salesPerson)
    });

  } catch (error) {
    console.error('❌ Error toggling commission exclusion:', error);
    return NextResponse.json(
      { error: 'Failed to update order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function recalculateMonthCommissions(salesPerson: string, month: number, year: number) {
  // Get all orders for this rep/month that are NOT excluded
  const ordersSnapshot = await adminDb
    .collection('sales_order_history')
    .where('salesPerson', '==', salesPerson)
    .where('commissionMonth', '==', month)
    .where('commissionYear', '==', year)
    .get();

  let totalRevenue = 0;
  let orderCount = 0;
  const processedOrders: string[] = [];

  for (const orderDoc of ordersSnapshot.docs) {
    const orderData = orderDoc.data();
    
    // Skip excluded orders
    if (orderData.excludeFromCommission) {
      console.log(`  ⏭️  Skipping excluded order: ${orderData.soNumber}`);
      continue;
    }

    // Get line items for this order
    const lineItemsSnapshot = await adminDb
      .collection('sales_order_line_items')
      .where('salesOrderId', '==', orderData.salesOrderId)
      .get();

    let orderTotal = 0;
    lineItemsSnapshot.docs.forEach(lineDoc => {
      const lineData = lineDoc.data();
      orderTotal += (lineData.totalPrice || 0);
    });

    totalRevenue += orderTotal;
    orderCount++;
    processedOrders.push(orderData.soNumber);
  }

  console.log(`  📊 Recalculated: ${orderCount} orders, $${totalRevenue.toLocaleString()} revenue`);

  // Update the monthly commission summary
  const summaryId = `${salesPerson}_${year}_${month}`;
  const summaryRef = adminDb.collection('monthly_commissions').doc(summaryId);
  
  await summaryRef.set({
    salesPerson,
    month,
    year,
    totalRevenue,
    orderCount,
    updatedAt: FieldValue.serverTimestamp(),
    recalculatedFromExclusion: true
  }, { merge: true });

  console.log(`  ✅ Updated monthly summary: ${summaryId}`);
}
