import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Get all available commission months with order counts
 */
export async function GET(req: NextRequest) {
  try {
    console.log('📊 Loading all orders to analyze months...');
    
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders').get();
    
    const monthCounts = new Map<string, number>();
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const month = order.commissionMonth || 'Unknown';
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    });
    
    const months = Array.from(monthCounts.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
    
    console.log('📊 Orders by Month:');
    months.forEach(({ month, count }) => {
      console.log(`   ${month}: ${count} orders`);
    });
    
    return NextResponse.json({
      success: true,
      totalOrders: ordersSnapshot.size,
      months
    });
    
  } catch (error: any) {
    console.error('❌ Error getting order months:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to get order months' 
    }, { status: 500 });
  }
}
