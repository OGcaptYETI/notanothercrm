import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Get customer sales summary for Sales Insights tab
 * Calculates metrics from fishbowl_sales_orders and fishbowl_soitems
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    
    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }
    
    console.log(`[Customer Summary] Loading data for customerId: ${customerId}`);
    
    // Query orders for this customer (try both string and numeric)
    let ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .where('customerId', '==', customerId)
      .get();
    
    // If no results with string, try numeric
    if (ordersSnapshot.empty && !isNaN(Number(customerId))) {
      ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
        .where('customerId', '==', Number(customerId))
        .get();
    }
    
    console.log(`[Customer Summary] Found ${ordersSnapshot.size} orders`);
    
    if (ordersSnapshot.empty) {
      return NextResponse.json({
        customerId,
        lifetimeValue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        velocity: 0,
        orderingTrends: {
          last30Days: 0,
          last60Days: 0,
          last90Days: 0,
          last180Days: 0,
          last365Days: 0
        },
        recentActivity: [],
        topProducts: []
      });
    }
    
    // Calculate metrics
    let lifetimeValue = 0;
    const orderDates: Date[] = [];
    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    const recentOrders: Array<{ orderNum: string; date: Date; amount: number }> = [];
    
    // Process orders
    for (const orderDoc of ordersSnapshot.docs) {
      const order = orderDoc.data();
      const orderDate = order.postingDate?.toDate() || order.dateCreated?.toDate();
      
      // Get line items for this order
      const lineItemsSnapshot = await adminDb
        .collection('fishbowl_soitems')
        .where('salesOrderId', '==', order.salesOrderId)
        .get();
      
      let orderTotal = 0;
      
      lineItemsSnapshot.forEach(itemDoc => {
        const item = itemDoc.data();
        const itemTotal = item.totalPrice || 0;
        orderTotal += itemTotal;
        
        // Track products
        const productKey = item.product || item.productNum || 'Unknown';
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            name: item.product || item.productNum || 'Unknown',
            quantity: 0,
            revenue: 0
          });
        }
        const product = productMap.get(productKey)!;
        product.quantity += item.quantity || 0;
        product.revenue += itemTotal;
      });
      
      lifetimeValue += orderTotal;
      
      if (orderDate) {
        orderDates.push(orderDate);
        recentOrders.push({
          orderNum: order.soNumber || order.num || orderDoc.id,
          date: orderDate,
          amount: orderTotal
        });
      }
    }
    
    // Sort orders by date
    recentOrders.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Calculate ordering trends
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const last180Days = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const last365Days = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const ytdStart = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
    
    const sales_30d = recentOrders.filter(o => o.date >= last30Days).reduce((sum, o) => sum + o.amount, 0);
    const sales_90d = recentOrders.filter(o => o.date >= last90Days).reduce((sum, o) => sum + o.amount, 0);
    const sales_180d = recentOrders.filter(o => o.date >= last180Days).reduce((sum, o) => sum + o.amount, 0);
    const totalSalesYTD = recentOrders.filter(o => o.date >= ytdStart).reduce((sum, o) => sum + o.amount, 0);
    
    const orders_30d = recentOrders.filter(o => o.date >= last30Days).length;
    const orders_90d = recentOrders.filter(o => o.date >= last90Days).length;
    const orders_180d = recentOrders.filter(o => o.date >= last180Days).length;
    const orderCountYTD = recentOrders.filter(o => o.date >= ytdStart).length;
    
    // Calculate trend (compare last 90 days to previous 90 days)
    const previous90Days = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const sales_previous_90d = recentOrders
      .filter(o => o.date >= previous90Days && o.date < last90Days)
      .reduce((sum, o) => sum + o.amount, 0);
    
    const trend = sales_previous_90d > 0 
      ? ((sales_90d - sales_previous_90d) / sales_previous_90d) * 100 
      : 0;
    
    // Calculate velocity (orders per month)
    const velocity = orderDates.length > 1 
      ? calculateVelocity(orderDates)
      : 0;
    
    // Last order info
    const lastOrder = recentOrders[0];
    const lastOrderDate = lastOrder ? lastOrder.date : null;
    const lastOrderAmount = lastOrder ? lastOrder.amount : 0;
    const daysSinceLastOrder = lastOrderDate 
      ? Math.floor((now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    // First order info
    const firstOrder = recentOrders[recentOrders.length - 1];
    const firstOrderDate = firstOrder ? firstOrder.date : null;
    
    // Top products
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(p => ({
        name: p.name,
        quantity: p.quantity,
        revenue: p.revenue
      }));
    
    const summary = {
      customerId,
      
      // Lifetime metrics
      lifetimeValue,
      totalSales: lifetimeValue,
      totalOrders: ordersSnapshot.size,
      orderCount: ordersSnapshot.size,
      avgOrderValue: ordersSnapshot.size > 0 ? lifetimeValue / ordersSnapshot.size : 0,
      velocity,
      
      // YTD metrics
      totalSalesYTD,
      orderCountYTD,
      
      // Period metrics
      sales_30d,
      sales_90d,
      sales_180d,
      orders_30d,
      orders_90d,
      orders_180d,
      
      // Trend
      trend,
      
      // Last order
      lastOrderDate: lastOrderDate ? lastOrderDate.toISOString() : null,
      lastOrderAmount,
      daysSinceLastOrder,
      
      // First order
      firstOrderDate: firstOrderDate ? firstOrderDate.toISOString() : null,
      
      // Detailed data
      orderingTrends: {
        last30Days: sales_30d,
        last60Days: recentOrders.filter(o => o.date >= last60Days).reduce((sum, o) => sum + o.amount, 0),
        last90Days: sales_90d,
        last180Days: sales_180d,
        last365Days: recentOrders.filter(o => o.date >= last365Days).reduce((sum, o) => sum + o.amount, 0)
      },
      recentActivity: recentOrders.slice(0, 10).map(o => ({
        orderNum: o.orderNum,
        date: o.date.toISOString(),
        amount: o.amount
      })),
      topProducts
    };
    
    console.log(`[Customer Summary] Calculated summary:`, {
      lifetimeValue: summary.lifetimeValue,
      totalOrders: summary.totalOrders,
      topProducts: summary.topProducts.length
    });
    
    return NextResponse.json(summary);
    
  } catch (error: any) {
    console.error('[Customer Summary] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to load customer summary' 
    }, { status: 500 });
  }
}

/**
 * Calculate ordering velocity (orders per month)
 */
function calculateVelocity(orderDates: Date[]): number {
  if (orderDates.length < 2) return 0;
  
  const sortedDates = orderDates.sort((a, b) => a.getTime() - b.getTime());
  const firstOrder = sortedDates[0];
  const lastOrder = sortedDates[sortedDates.length - 1];
  
  const daysBetween = (lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24);
  const monthsBetween = daysBetween / 30;
  
  if (monthsBetween === 0) return orderDates.length;
  
  return orderDates.length / monthsBetween;
}
