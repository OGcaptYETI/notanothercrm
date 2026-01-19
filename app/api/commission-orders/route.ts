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

    // Build commission month string in YYYY-MM format (e.g., "2025-12") to match Reports page
    const commissionMonth = `${year}-${month.padStart(2, '0')}`;

    // Query monthly_commissions collection (same as reports page)
    let query = adminDb
      .collection('monthly_commissions')
      .where('commissionMonth', '==', commissionMonth);

    // Add sales person filter if provided
    if (salesPerson && salesPerson !== 'all') {
      query = query.where('salesPerson', '==', salesPerson);
    }

    const snapshot = await query.get();

    console.log(`📦 Found ${snapshot.size} commission records for ${commissionMonth}`);

    // Map commission records to order format
    const orders = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Convert Firestore Timestamp to ISO string for API response
      let postingDate = '';
      if (data.orderDate) {
        if (data.orderDate.toDate) {
          // Firestore Timestamp
          postingDate = data.orderDate.toDate().toISOString();
        } else if (typeof data.orderDate === 'string') {
          postingDate = data.orderDate;
        } else if (data.orderDate instanceof Date) {
          postingDate = data.orderDate.toISOString();
        }
      }
      
      return {
        id: doc.id,
        soNumber: data.orderNum || '',
        salesOrderId: data.salesOrderId || '',
        customerName: data.customerName || '',
        salesPerson: data.salesPerson || '',
        postingDate,
        totalPrice: data.orderRevenue || 0,
        commissionAmount: data.commissionAmount || 0,
        commissionRate: data.commissionRate || 0,
        accountType: data.accountType || data.customerSegment || 'Unknown',
        excludeFromCommission: data.excludeFromCommission || false,
        commissionNote: data.commissionNote || '',
        customerSegment: data.customerSegment || '',
        customerStatus: data.customerStatus || ''
      };
    });

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
