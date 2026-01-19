import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recalculate commission summary for a specific rep/month
 */
async function recalculateSummary(salesPerson: string, month: string, year: string) {
  const commissionMonth = `${year}-${month.padStart(2, '0')}`;
  console.log(`🔄 Recalculating summary for ${salesPerson} - ${commissionMonth}`);

  // Get the rep's full name from users collection
  const usersSnapshot = await adminDb
    .collection('users')
    .where('salesPerson', '==', salesPerson)
    .limit(1)
    .get();

  let repName = salesPerson; // Default to salesPerson if not found
  if (!usersSnapshot.empty) {
    const userData = usersSnapshot.docs[0].data();
    repName = userData.name || salesPerson;
  }

  // Query all commission records for this rep/month
  const commissionsSnapshot = await adminDb
    .collection('monthly_commissions')
    .where('salesPerson', '==', salesPerson)
    .where('commissionMonth', '==', commissionMonth)
    .get();

  console.log(`📊 Found ${commissionsSnapshot.size} commission records`);

  // Calculate totals
  let totalOrders = 0;
  let totalRevenue = 0;
  let totalCommission = 0;
  let totalSpiffs = 0;
  let totalExcluded = 0;
  let excludedRevenue = 0;
  let excludedCommission = 0;

  commissionsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    
    if (data.excludeFromCommission) {
      totalExcluded++;
      excludedRevenue += data.orderRevenue || 0;
      excludedCommission += data.commissionAmount || 0;
    } else {
      totalOrders++;
      totalRevenue += data.orderRevenue || 0;
      totalCommission += data.commissionAmount || 0;
      totalSpiffs += data.spiffAmount || 0;
    }
  });

  // Update or create summary document
  const summaryId = `${salesPerson}_${commissionMonth}`;
  const summaryRef = adminDb.collection('monthly_commission_summary').doc(summaryId);

  const summaryData = {
    salesPerson,
    repName, // Full name like "Brandon Good"
    commissionMonth,
    month: commissionMonth, // Store as "2025-12" format for Reports page filtering
    year: parseInt(year),
    totalOrders,
    totalRevenue,
    totalCommission,
    totalSpiffs,
    totalExcluded,
    excludedRevenue,
    excludedCommission,
    updatedAt: Timestamp.now(),
    lastRecalculated: Timestamp.now()
  };

  await summaryRef.set(summaryData, { merge: true });

  console.log(`✅ Updated summary for ${repName} (${salesPerson}) - ${commissionMonth}`);
  console.log(`   Total Orders: ${totalOrders}`);
  console.log(`   Total Revenue: $${totalRevenue.toLocaleString()}`);
  console.log(`   Total Commission: $${totalCommission.toLocaleString()}`);
  console.log(`   Total Spiffs: $${totalSpiffs.toLocaleString()}`);
  console.log(`   Excluded: ${totalExcluded}`);

  return summaryData;
}

export async function POST(request: NextRequest) {
  try {
    const { orderId, fromMonth, fromYear, toMonth, toYear, reason } = await request.json();

    if (!orderId || !fromMonth || !fromYear || !toMonth || !toYear) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`📅 Moving order ${orderId} from ${fromYear}-${fromMonth} to ${toYear}-${toMonth}`);

    const fromCommissionMonth = `${fromYear}-${fromMonth.padStart(2, '0')}`;
    const toCommissionMonth = `${toYear}-${toMonth.padStart(2, '0')}`;

    // Validate we're not moving to the same month
    if (fromCommissionMonth === toCommissionMonth) {
      return NextResponse.json(
        { error: 'Cannot move order to the same month' },
        { status: 400 }
      );
    }

    // Get the order document
    const orderRef = adminDb.collection('monthly_commissions').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const orderData = orderDoc.data();

    // Verify the order is currently in the source month
    if (orderData?.commissionMonth !== fromCommissionMonth) {
      return NextResponse.json(
        { error: `Order is not in month ${fromCommissionMonth}. Current month: ${orderData?.commissionMonth}` },
        { status: 400 }
      );
    }

    // Update the order with new commission month and audit trail
    await orderRef.update({
      commissionMonth: toCommissionMonth,
      movedFromMonth: fromCommissionMonth,
      movedToMonth: toCommissionMonth,
      moveReason: reason || '',
      movedAt: Timestamp.now(),
      movedBy: 'admin', // TODO: Get actual user from session
      updatedAt: Timestamp.now()
    });

    console.log(`✅ Order ${orderId} moved successfully`);
    console.log(`   From: ${fromCommissionMonth}`);
    console.log(`   To: ${toCommissionMonth}`);
    console.log(`   Reason: ${reason || 'No reason provided'}`);

    // Get the sales person from the order data for targeted recalculation
    const salesPerson = orderData?.salesPerson || orderData?.repName || '';
    
    if (!salesPerson) {
      console.warn('⚠️ No sales person found on order - skipping summary recalculation');
    } else {
      // Directly call recalculation function for both months (only this rep)
      try {
        // Recalculate source month summary (where order was removed from)
        const fromSummary = await recalculateSummary(salesPerson, fromMonth, fromYear);
        console.log(`✅ Recalculated ${fromCommissionMonth} for ${fromSummary.repName}: ${fromSummary.totalOrders} orders, $${fromSummary.totalCommission.toLocaleString()}`);

        // Recalculate target month summary (where order was added to)
        const toSummary = await recalculateSummary(salesPerson, toMonth, toYear);
        console.log(`✅ Recalculated ${toCommissionMonth} for ${toSummary.repName}: ${toSummary.totalOrders} orders, $${toSummary.totalCommission.toLocaleString()}`);
      } catch (recalcError) {
        console.error('❌ Error during recalculation:', recalcError);
        // Don't fail the whole operation if recalculation fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Order moved from ${fromCommissionMonth} to ${toCommissionMonth}`,
      orderId,
      fromMonth: fromCommissionMonth,
      toMonth: toCommissionMonth
    });

  } catch (error) {
    console.error('❌ Error moving commission order:', error);
    return NextResponse.json(
      { error: 'Failed to move order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
