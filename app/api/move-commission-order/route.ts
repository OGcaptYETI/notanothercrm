import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      // Trigger smart recalculation for both months (only this rep)
      console.log(`🔄 Recalculating summaries for ${salesPerson}...`);

      try {
        // Recalculate source month summary (where order was removed from)
        const fromRecalcResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/recalculate-commission-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salesPerson,
            month: fromMonth,
            year: fromYear
          })
        });

        if (!fromRecalcResponse.ok) {
          console.warn(`⚠️ Failed to recalculate source month ${fromCommissionMonth} for ${salesPerson}`);
        } else {
          const fromResult = await fromRecalcResponse.json();
          console.log(`✅ Recalculated ${fromCommissionMonth} for ${fromResult.summary?.repName || salesPerson}: ${fromResult.summary?.totalOrders || 0} orders, $${fromResult.summary?.totalCommission?.toLocaleString() || 0}`);
        }

        // Recalculate target month summary (where order was added to)
        const toRecalcResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/recalculate-commission-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salesPerson,
            month: toMonth,
            year: toYear
          })
        });

        if (!toRecalcResponse.ok) {
          console.warn(`⚠️ Failed to recalculate target month ${toCommissionMonth} for ${salesPerson}`);
        } else {
          const toResult = await toRecalcResponse.json();
          console.log(`✅ Recalculated ${toCommissionMonth} for ${toResult.summary?.repName || salesPerson}: ${toResult.summary?.totalOrders || 0} orders, $${toResult.summary?.totalCommission?.toLocaleString() || 0}`);
        }
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
