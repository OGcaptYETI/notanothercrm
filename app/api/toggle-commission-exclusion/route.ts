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

    // Update the commission record in monthly_commissions
    const commissionRef = adminDb.collection('monthly_commissions').doc(orderId);
    const commissionDoc = await commissionRef.get();

    if (!commissionDoc.exists) {
      return NextResponse.json(
        { error: 'Commission record not found' },
        { status: 404 }
      );
    }

    const orderData = commissionDoc.data();
    
    // Update the exclusion flag
    await commissionRef.update({
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
  // Build commission month string in YYYY-MM format to match Reports page
  const commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
  
  // Get all commission records for this rep/month
  const commissionsSnapshot = await adminDb
    .collection('monthly_commissions')
    .where('salesPerson', '==', salesPerson)
    .where('commissionMonth', '==', commissionMonth)
    .get();

  let totalRevenue = 0;
  let totalCommission = 0;
  let orderCount = 0;
  const processedOrders: string[] = [];

  for (const commissionDoc of commissionsSnapshot.docs) {
    const commissionData = commissionDoc.data();
    
    // Skip excluded orders
    if (commissionData.excludeFromCommission) {
      console.log(`  ⏭️  Skipping excluded order: ${commissionData.orderNum}`);
      continue;
    }

    totalRevenue += (commissionData.orderRevenue || 0);
    totalCommission += (commissionData.commissionAmount || 0);
    orderCount++;
    processedOrders.push(commissionData.orderNum);
  }

  console.log(`  📊 Recalculated: ${orderCount} orders, $${totalRevenue.toLocaleString()} revenue, $${totalCommission.toLocaleString()} commission`);

  // Update the monthly commission summary
  const summaryId = `${salesPerson}_${commissionMonth}`;
  const summaryRef = adminDb.collection('monthly_commission_summary').doc(summaryId);
  
  await summaryRef.set({
    salesPerson,
    month: commissionMonth,
    year,
    totalRevenue,
    totalCommission,
    totalOrders: orderCount,
    updatedAt: FieldValue.serverTimestamp(),
    recalculatedFromExclusion: true
  }, { merge: true });

  console.log(`  ✅ Updated monthly summary: ${summaryId}`);
}
