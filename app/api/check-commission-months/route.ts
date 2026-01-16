import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Checking commission months in database...');
    
    // Get all unique commission months from line items
    const itemsSnapshot = await adminDb.collection('fishbowl_soitems').get();
    
    const monthCounts = new Map<string, number>();
    const sampleDates = new Map<string, any[]>();
    
    itemsSnapshot.forEach(doc => {
      const data = doc.data();
      const month = data.commissionMonth || 'MISSING';
      
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
      
      // Store sample dates
      if (!sampleDates.has(month)) {
        sampleDates.set(month, []);
      }
      if (sampleDates.get(month)!.length < 3) {
        sampleDates.get(month)!.push({
          soNumber: data.soNumber,
          postingDate: data.postingDate?.toDate?.() || 'none',
          commissionMonth: data.commissionMonth
        });
      }
    });
    
    const results = Array.from(monthCounts.entries())
      .map(([month, count]) => ({
        commissionMonth: month,
        lineItemCount: count,
        samples: sampleDates.get(month) || []
      }))
      .sort((a, b) => b.lineItemCount - a.lineItemCount);
    
    console.log('\n📊 Commission Months Found:');
    results.forEach(r => {
      console.log(`   ${r.commissionMonth}: ${r.lineItemCount} line items`);
    });
    
    return NextResponse.json({
      success: true,
      totalLineItems: itemsSnapshot.size,
      commissionMonths: results
    });
    
  } catch (error: any) {
    console.error('Error checking commission months:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
