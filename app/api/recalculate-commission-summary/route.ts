import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Smart recalculation endpoint that ONLY updates summary for specific rep/month combinations
 * Much faster than full recalculation - typically < 1 second
 */
export async function POST(request: NextRequest) {
  try {
    const { salesPerson, month, year } = await request.json();

    if (!salesPerson || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required fields: salesPerson, month, year' },
        { status: 400 }
      );
    }

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

    return NextResponse.json({
      success: true,
      summary: summaryData
    });

  } catch (error) {
    console.error('❌ Error recalculating commission summary:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
