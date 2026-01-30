import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all January orders
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .where('commissionMonth', '==', '2026-01')
      .get();
    
    console.log(`\nAnalyzing ${ordersSnapshot.size} orders for January 2026...`);
    
    // Get date range
    const dates: Date[] = [];
    const ordersByDate = new Map<string, number>();
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      if (order.postingDate?._seconds) {
        const date = new Date(order.postingDate._seconds * 1000);
        dates.push(date);
        
        const dateKey = date.toISOString().split('T')[0];
        ordersByDate.set(dateKey, (ordersByDate.get(dateKey) || 0) + 1);
      }
    });
    
    dates.sort((a, b) => a.getTime() - b.getTime());
    
    const minDate = dates.length > 0 ? dates[0].toISOString().split('T')[0] : null;
    const maxDate = dates.length > 0 ? dates[dates.length - 1].toISOString().split('T')[0] : null;
    
    // Count orders by rep
    const ordersByRep = new Map<string, number>();
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const rep = order.salesPerson || 'Unknown';
      ordersByRep.set(rep, (ordersByRep.get(rep) || 0) + 1);
    });
    
    // Check for orders that might be missing commissionMonth
    const allOrdersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .get();
    
    let januaryOrdersWithoutMonth = 0;
    const missingMonthSamples: any[] = [];
    
    allOrdersSnapshot.forEach(doc => {
      const order = doc.data();
      if (order.postingDate?._seconds) {
        const date = new Date(order.postingDate._seconds * 1000);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        if (year === 2026 && month === 1) {
          // This order's postingDate is in January 2026
          if (order.commissionMonth !== '2026-01') {
            januaryOrdersWithoutMonth++;
            if (missingMonthSamples.length < 10) {
              missingMonthSamples.push({
                soNumber: order.soNumber,
                postingDate: date.toISOString(),
                commissionMonth: order.commissionMonth,
                salesPerson: order.salesPerson
              });
            }
          }
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      ordersWithCommissionMonth: ordersSnapshot.size,
      dateRange: {
        min: minDate,
        max: maxDate,
        span: dates.length > 0 ? `${dates.length} days` : 'N/A'
      },
      ordersByRep: Object.fromEntries(ordersByRep),
      ordersByDate: Object.fromEntries(
        Array.from(ordersByDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      ),
      januaryOrdersMissingCommissionMonth: januaryOrdersWithoutMonth,
      missingMonthSamples
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
