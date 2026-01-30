import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', '2026-01')
      .get();
    
    console.log(`\nChecking ${lineItemsSnapshot.size} line items for January 2026...`);
    
    // Group by soItemId (the actual line item ID from Fishbowl)
    const soItemIdGroups = new Map<string, any[]>();
    
    lineItemsSnapshot.forEach(doc => {
      const item = doc.data();
      const soItemId = item.soItemId;
      
      if (!soItemId) {
        return;
      }
      
      if (!soItemIdGroups.has(soItemId)) {
        soItemIdGroups.set(soItemId, []);
      }
      
      soItemIdGroups.get(soItemId)!.push({
        firestoreDocId: doc.id,
        soItemId: item.soItemId,
        soNumber: item.soNumber,
        salesOrderId: item.salesOrderId,
        productNum: item.productNum,
        totalPrice: item.totalPrice,
        salesPerson: item.salesPerson
      });
    });
    
    // Find duplicates (same soItemId appearing multiple times)
    const duplicates = Array.from(soItemIdGroups.entries())
      .filter(([_, items]) => items.length > 1)
      .map(([soItemId, items]) => ({
        soItemId,
        count: items.length,
        items
      }))
      .sort((a, b) => b.count - a.count);
    
    // Calculate duplicate revenue impact
    let totalDuplicateRevenue = 0;
    const repDuplicateRevenue = new Map<string, number>();
    
    for (const dup of duplicates) {
      // Each duplicate contributes (count - 1) * price to inflated revenue
      const firstItem = dup.items[0];
      const duplicateImpact = (dup.count - 1) * (Number(firstItem.totalPrice) || 0);
      totalDuplicateRevenue += duplicateImpact;
      
      const rep = firstItem.salesPerson || 'Unknown';
      repDuplicateRevenue.set(rep, (repDuplicateRevenue.get(rep) || 0) + duplicateImpact);
    }
    
    return NextResponse.json({
      success: true,
      totalLineItems: lineItemsSnapshot.size,
      uniqueSoItemIds: soItemIdGroups.size,
      duplicateGroups: duplicates.length,
      totalDuplicateRevenue,
      repDuplicateRevenue: Object.fromEntries(repDuplicateRevenue),
      sampleDuplicates: duplicates.slice(0, 20)
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
