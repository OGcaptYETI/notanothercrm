import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', '2026-01')
      .get();
    
    console.log(`\nChecking ${lineItemsSnapshot.size} line items for comma-formatting duplicates...`);
    
    // Group by normalized soItemId (remove commas) AND salesOrderId
    const normalizedGroups = new Map<string, any[]>();
    
    lineItemsSnapshot.forEach(doc => {
      const item = doc.data();
      const soItemId = String(item.soItemId || '');
      const salesOrderId = item.salesOrderId;
      
      if (!soItemId || !salesOrderId) {
        return;
      }
      
      // Normalize: remove commas and whitespace
      const normalized = `${salesOrderId}_${soItemId.replace(/[,\s]/g, '')}`;
      
      if (!normalizedGroups.has(normalized)) {
        normalizedGroups.set(normalized, []);
      }
      
      normalizedGroups.get(normalized)!.push({
        firestoreDocId: doc.id,
        soItemId: item.soItemId,
        soNumber: item.soNumber,
        salesOrderId: item.salesOrderId,
        productNum: item.productNum,
        totalPrice: item.totalPrice,
        salesPerson: item.salesPerson
      });
    });
    
    // Find groups with multiple documents
    const duplicates = Array.from(normalizedGroups.entries())
      .filter(([_, items]) => items.length > 1)
      .map(([key, items]) => ({
        normalizedKey: key,
        count: items.length,
        items
      }))
      .sort((a, b) => b.count - a.count);
    
    // Calculate duplicate revenue impact
    let totalDuplicateRevenue = 0;
    const repDuplicateRevenue = new Map<string, number>();
    
    for (const dup of duplicates) {
      // Sum all prices for this duplicate group
      const totalPrice = dup.items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
      // The duplicate impact is the total minus the first one (what should be counted)
      const firstItemPrice = Number(dup.items[0].totalPrice) || 0;
      const duplicateImpact = totalPrice - firstItemPrice;
      
      totalDuplicateRevenue += duplicateImpact;
      
      const rep = dup.items[0].salesPerson || 'Unknown';
      repDuplicateRevenue.set(rep, (repDuplicateRevenue.get(rep) || 0) + duplicateImpact);
    }
    
    const repDuplicateRevenueFormatted = Array.from(repDuplicateRevenue.entries())
      .map(([rep, revenue]) => ({
        rep,
        revenue,
        formatted: `$${revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      }))
      .sort((a, b) => b.revenue - a.revenue);
    
    return NextResponse.json({
      success: true,
      totalLineItems: lineItemsSnapshot.size,
      uniqueNormalized: normalizedGroups.size,
      duplicateGroups: duplicates.length,
      totalDuplicateRevenue,
      totalDuplicateRevenueFormatted: `$${totalDuplicateRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      repDuplicateRevenue: repDuplicateRevenueFormatted,
      sampleDuplicates: duplicates.slice(0, 20)
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
