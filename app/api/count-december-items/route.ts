import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('\n🔍 COUNTING DECEMBER 2025 LINE ITEMS IN FIRESTORE');
    
    // Get all line items with commissionMonth = 2025-12
    const dec2025Items = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', '2025-12')
      .get();
    
    console.log(`📦 Found ${dec2025Items.size} line items with commissionMonth = 2025-12`);
    
    // Group by sales person
    const bySalesPerson = new Map<string, { count: number; revenue: number }>();
    
    dec2025Items.forEach(doc => {
      const item = doc.data();
      const sp = item.salesPerson || 'Unknown';
      const revenue = item.totalPrice || 0;
      
      if (!bySalesPerson.has(sp)) {
        bySalesPerson.set(sp, { count: 0, revenue: 0 });
      }
      
      const data = bySalesPerson.get(sp)!;
      data.count++;
      data.revenue += revenue;
    });
    
    console.log('\n💰 BY SALES PERSON:');
    let total = 0;
    bySalesPerson.forEach((data, sp) => {
      console.log(`   ${sp}: $${data.revenue.toFixed(2)} (${data.count} items)`);
      total += data.revenue;
    });
    console.log(`   TOTAL: $${total.toFixed(2)}`);
    
    // Check for items with no commissionMonth
    const noCommissionMonth = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', null)
      .limit(10)
      .get();
    
    console.log(`\n⚠️  Items with no commissionMonth: ${noCommissionMonth.size} (showing first 10)`);
    
    // Check total items in collection
    const allItems = await adminDb.collection('fishbowl_soitems').count().get();
    console.log(`\n📊 Total items in fishbowl_soitems: ${allItems.data().count}`);
    
    return NextResponse.json({
      success: true,
      december2025Items: dec2025Items.size,
      totalItems: allItems.data().count,
      bySalesPerson: Object.fromEntries(bySalesPerson),
      totalRevenue: total
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
