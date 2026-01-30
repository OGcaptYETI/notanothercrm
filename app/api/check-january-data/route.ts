import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check January 2026 sales orders
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .where('commissionMonth', '==', '2026-01')
      .get();
    
    console.log(`\nFound ${ordersSnapshot.size} orders for January 2026`);
    
    // Count by sales person
    const repOrders = new Map<string, number>();
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const rep = order.salesPerson || 'Unknown';
      repOrders.set(rep, (repOrders.get(rep) || 0) + 1);
    });
    
    // Check line items for January 2026
    const salesOrderIds = ordersSnapshot.docs.map(doc => doc.data().salesOrderId);
    
    let totalLineItems = 0;
    const repRevenue = new Map<string, number>();
    
    console.log(`\nChecking line items for ${salesOrderIds.length} orders...`);
    
    // Check duplicates
    const allSoItemIds = new Map<string, number>();
    
    for (const orderId of salesOrderIds) {
      const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
        .where('salesOrderId', '==', orderId)
        .get();
      
      totalLineItems += lineItemsSnapshot.size;
      
      lineItemsSnapshot.forEach(doc => {
        const item = doc.data();
        const soItemId = item.soItemId || doc.id;
        allSoItemIds.set(soItemId, (allSoItemIds.get(soItemId) || 0) + 1);
        
        const rep = item.salesPerson || 'Unknown';
        const revenue = Number(item.totalPrice || 0);
        repRevenue.set(rep, (repRevenue.get(rep) || 0) + revenue);
      });
    }
    
    // Find duplicates
    const duplicates = Array.from(allSoItemIds.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
    
    const repOrdersArray = Array.from(repOrders.entries())
      .sort((a, b) => b[1] - a[1]);
    
    const repRevenueArray = Array.from(repRevenue.entries())
      .map(([rep, revenue]) => ({
        rep,
        revenue,
        formatted: `$${revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      }))
      .sort((a, b) => b.revenue - a.revenue);
    
    return NextResponse.json({
      success: true,
      month: '2026-01',
      totalOrders: ordersSnapshot.size,
      totalLineItems,
      ordersByRep: Object.fromEntries(repOrdersArray),
      revenueByRep: repRevenueArray,
      duplicateCount: duplicates.length,
      duplicateSample: duplicates.slice(0, 10).map(([id, count]) => ({
        soItemId: id,
        duplicateCount: count
      }))
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
