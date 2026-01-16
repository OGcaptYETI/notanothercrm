import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Check line items with commissionMonth = "2025-12" 
 * and sum totalPrice by salesOrderId to find actual December revenue
 */
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Checking December 2025 line items...');
    
    // Get all line items with commissionMonth = "2025-12"
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', '2025-12')
      .get();
    
    console.log(`Found ${lineItemsSnapshot.size} line items with commissionMonth = "2025-12"`);
    
    // Group by salesOrderId and sum totalPrice
    const orderTotals = new Map<string, {
      salesOrderId: string;
      soNumber: string;
      salesPerson: string;
      customerName: string;
      totalPrice: number;
      lineItemCount: number;
    }>();
    
    lineItemsSnapshot.forEach(doc => {
      const item = doc.data();
      const salesOrderId = item.salesOrderId;
      const totalPrice = item.totalPrice || 0;
      
      if (!orderTotals.has(salesOrderId)) {
        orderTotals.set(salesOrderId, {
          salesOrderId,
          soNumber: item.soNumber || 'Unknown',
          salesPerson: item.salesPerson || 'Unknown',
          customerName: item.customerName || 'Unknown',
          totalPrice: 0,
          lineItemCount: 0
        });
      }
      
      const order = orderTotals.get(salesOrderId)!;
      order.totalPrice += totalPrice;
      order.lineItemCount++;
    });
    
    console.log(`Aggregated into ${orderTotals.size} unique sales orders`);
    
    // Group by sales person
    const repBreakdown = new Map<string, { orders: number; revenue: number; orderNums: string[] }>();
    
    orderTotals.forEach(order => {
      const salesPerson = order.salesPerson;
      
      if (!repBreakdown.has(salesPerson)) {
        repBreakdown.set(salesPerson, { orders: 0, revenue: 0, orderNums: [] });
      }
      
      const stats = repBreakdown.get(salesPerson)!;
      stats.orders++;
      stats.revenue += order.totalPrice;
      stats.orderNums.push(order.soNumber);
    });
    
    // Calculate totals
    let totalOrders = orderTotals.size;
    let totalRevenue = 0;
    
    orderTotals.forEach(order => {
      totalRevenue += order.totalPrice;
    });
    
    const breakdown = Array.from(repBreakdown.entries()).map(([salesPerson, stats]) => ({
      salesPerson,
      orders: stats.orders,
      revenue: stats.revenue,
      orderNums: stats.orderNums.sort()
    })).sort((a, b) => b.revenue - a.revenue);
    
    console.log('\n📊 DECEMBER 2025 LINE ITEMS BREAKDOWN:');
    console.log(`Total Orders: ${totalOrders}`);
    console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
    breakdown.forEach(({ salesPerson, orders, revenue }) => {
      console.log(`  ${salesPerson}: ${orders} orders | $${revenue.toFixed(2)}`);
    });
    
    // Expected from Fishbowl
    const fishbowlExpected = {
      BenW: { orders: 45, revenue: 364436.20 },
      BrandonG: { orders: 85, revenue: 294142.40 },
      DerekW: { orders: 51, revenue: 317437.00 },
      Jared: { orders: 22, revenue: 190613.00 },
      Zalak: { orders: 23, revenue: 455989.20 }
    };
    
    const fishbowlTotal = {
      orders: 226,
      revenue: 1622617.80
    };
    
    // Calculate differences
    const differences = breakdown.map(({ salesPerson, orders, revenue }) => {
      const exp = fishbowlExpected[salesPerson as keyof typeof fishbowlExpected];
      if (!exp) return null;
      
      return {
        salesPerson,
        actualOrders: orders,
        expectedOrders: exp.orders,
        missingOrders: exp.orders - orders,
        actualRevenue: revenue,
        expectedRevenue: exp.revenue,
        revenueDiff: exp.revenue - revenue,
        percentMatch: (revenue / exp.revenue * 100).toFixed(1) + '%'
      };
    }).filter(Boolean);
    
    return NextResponse.json({
      success: true,
      lineItems: {
        totalLineItems: lineItemsSnapshot.size,
        totalOrders,
        totalRevenue,
        breakdown
      },
      fishbowl: {
        totalOrders: fishbowlTotal.orders,
        totalRevenue: fishbowlTotal.revenue,
        expected: fishbowlExpected
      },
      differences: {
        missingOrders: fishbowlTotal.orders - totalOrders,
        missingRevenue: fishbowlTotal.revenue - totalRevenue,
        byRep: differences
      },
      orders: Array.from(orderTotals.values()).sort((a, b) => b.totalPrice - a.totalPrice)
    });
    
  } catch (error: any) {
    console.error('❌ Error checking December line items:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to check December line items' 
    }, { status: 500 });
  }
}
