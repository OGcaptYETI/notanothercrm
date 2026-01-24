import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { orderId, newRate, comment, month, year } = await request.json();

    if (!orderId || newRate === undefined || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!comment || !comment.trim()) {
      return NextResponse.json(
        { error: 'Comment is required for rate changes' },
        { status: 400 }
      );
    }

    console.log(`✏️ Updating commission rate for order ${orderId} to ${newRate}%`);

    // Get the commission record from monthly_commissions (what the UI reads)
    const commissionRef = adminDb.collection('monthly_commissions').doc(orderId);
    const commissionDoc = await commissionRef.get();

    if (!commissionDoc.exists) {
      return NextResponse.json(
        { error: 'Commission record not found' },
        { status: 404 }
      );
    }

    const commissionData = commissionDoc.data();
    const orderRevenue = commissionData?.orderRevenue || 0;
    const salesPerson = commissionData?.salesPerson || '';
    const originalRate = commissionData?.commissionRate || 0;

    // Calculate new commission amount
    const newCommissionAmount = (orderRevenue * newRate) / 100;

    console.log(`  Original: ${originalRate}% = $${(orderRevenue * originalRate / 100).toFixed(2)}`);
    console.log(`  New: ${newRate}% = $${newCommissionAmount.toFixed(2)}`);

    // Update the commission record with new rate and tracking
    await commissionRef.update({
      commissionRate: newRate,
      commissionAmount: newCommissionAmount,
      rateModified: true,
      rateComment: comment,
      originalRate: originalRate,
      rateUpdatedAt: new Date(),
      rateUpdatedBy: 'admin'
    });

    console.log(`✅ Updated commission record for order ${orderId}`);

    // Recalculate monthly summary for this sales rep
    if (salesPerson) {
      await recalculateMonthlySummary(salesPerson, month, year);
    }

    return NextResponse.json({
      success: true,
      newCommissionAmount,
      message: 'Commission rate updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating commission rate:', error);
    return NextResponse.json(
      { error: 'Failed to update commission rate' },
      { status: 500 }
    );
  }
}

async function recalculateMonthlySummary(salesPerson: string, month: string, year: string) {
  try {
    // Build commission month string in YYYY-MM format to match Reports page
    const commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
    
    console.log(`🔄 Recalculating monthly summary for ${salesPerson} - ${commissionMonth}`);

    // Get all commission records for this rep/month from monthly_commissions
    const commissionsSnapshot = await adminDb
      .collection('monthly_commissions')
      .where('salesPerson', '==', salesPerson)
      .where('commissionMonth', '==', commissionMonth)
      .get();

    let totalRevenue = 0;
    let totalCommission = 0;
    let orderCount = 0;

    commissionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Skip excluded orders
      if (data.excludeFromCommission) {
        return;
      }

      totalRevenue += (data.orderRevenue || 0);
      totalCommission += (data.commissionAmount || 0);
      orderCount++;
    });

    console.log(`  📊 ${orderCount} orders, $${totalRevenue.toLocaleString()} revenue, $${totalCommission.toLocaleString()} commission`);

    // Update the monthly commission summary
    const summaryId = `${salesPerson}_${commissionMonth}`;
    const summaryRef = adminDb.collection('monthly_commission_summary').doc(summaryId);
    
    await summaryRef.set({
      salesPerson,
      month: commissionMonth,
      year: parseInt(year),
      totalRevenue,
      totalCommission,
      totalOrders: orderCount,
      updatedAt: new Date(),
      recalculatedFromRateChange: true
    }, { merge: true });

    console.log(`✅ Updated monthly summary: ${summaryId}`);

  } catch (error) {
    console.error('Error recalculating monthly summary:', error);
    throw error;
  }
}
