import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Search for orders by sales person across ALL months
 * to find if December orders were assigned to wrong months
 */
export async function POST(req: NextRequest) {
  try {
    const { salesPerson, expectedOrders } = await req.json();
    
    console.log(`🔍 Searching for all ${salesPerson} orders across all months...`);
    
    // Get all line items for this sales person
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
      .where('salesPerson', '==', salesPerson)
      .get();
    
    console.log(`Found ${lineItemsSnapshot.size} line items for ${salesPerson}`);
    
    // Group by commission month and salesOrderId
    const monthBreakdown = new Map<string, Map<string, number>>();
    
    lineItemsSnapshot.forEach(doc => {
      const item = doc.data();
      const month = item.commissionMonth || 'Unknown';
      const salesOrderId = item.salesOrderId;
      const totalPrice = item.totalPrice || 0;
      
      if (!monthBreakdown.has(month)) {
        monthBreakdown.set(month, new Map());
      }
      
      const orders = monthBreakdown.get(month)!;
      if (!orders.has(salesOrderId)) {
        orders.set(salesOrderId, 0);
      }
      orders.set(salesOrderId, orders.get(salesOrderId)! + totalPrice);
    });
    
    // Convert to array
    const breakdown = Array.from(monthBreakdown.entries()).map(([month, orders]) => {
      const orderCount = orders.size;
      let revenue = 0;
      orders.forEach(total => revenue += total);
      
      return {
        month,
        orders: orderCount,
        revenue,
        orderList: Array.from(orders.entries()).map(([id, total]) => ({ salesOrderId: id, total }))
      };
    }).sort((a, b) => a.month.localeCompare(b.month));
    
    console.log(`\n📊 ${salesPerson} ORDERS BY MONTH:`);
    breakdown.forEach(({ month, orders, revenue }) => {
      console.log(`  ${month}: ${orders} orders | $${revenue.toFixed(2)}`);
    });
    
    return NextResponse.json({
      success: true,
      salesPerson,
      totalLineItems: lineItemsSnapshot.size,
      breakdown
    });
    
  } catch (error: any) {
    console.error('❌ Error searching orders:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to search orders' 
    }, { status: 500 });
  }
}
