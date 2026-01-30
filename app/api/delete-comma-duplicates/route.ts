import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dryRun = body.dryRun !== false; // Default to dry run
    const targetMonth = body.month || '2026-01';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🗑️  DELETE COMMA-FORMATTED DUPLICATES ${dryRun ? '🟢 DRY RUN' : '🔴 LIVE MODE'}`);
    console.log(`📅 Target Month: ${targetMonth}`);
    console.log(`${'='.repeat(80)}\n`);
    
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', targetMonth)
      .get();
    
    console.log(`📦 Loaded ${lineItemsSnapshot.size} line items`);
    
    // Group by normalized soItemId (remove commas)
    const normalizedGroups = new Map<string, any[]>();
    
    lineItemsSnapshot.forEach(doc => {
      const item = doc.data();
      const soItemId = String(item.soItemId || '');
      const salesOrderId = item.salesOrderId;
      
      if (!soItemId || !salesOrderId) {
        return;
      }
      
      const normalized = `${salesOrderId}_${soItemId.replace(/[,\s]/g, '')}`;
      
      if (!normalizedGroups.has(normalized)) {
        normalizedGroups.set(normalized, []);
      }
      
      normalizedGroups.get(normalized)!.push({
        docRef: doc.ref,
        firestoreDocId: doc.id,
        soItemId: item.soItemId,
        soNumber: item.soNumber,
        salesOrderId: item.salesOrderId,
        productNum: item.productNum,
        totalPrice: item.totalPrice,
        salesPerson: item.salesPerson
      });
    });
    
    // Find duplicates and determine which to delete
    let batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;
    
    let stats = {
      duplicateGroups: 0,
      documentsToDelete: 0,
      duplicateRevenue: 0
    };
    
    const toDelete: any[] = [];
    
    for (const [key, items] of normalizedGroups.entries()) {
      if (items.length <= 1) continue; // Not a duplicate
      
      stats.duplicateGroups++;
      
      // Sort: prefer items WITHOUT commas in soItemId (sanitized version)
      // Delete items WITH commas (original import with comma formatting)
      items.sort((a, b) => {
        const aHasComma = a.soItemId.includes(',');
        const bHasComma = b.soItemId.includes(',');
        if (aHasComma && !bHasComma) return 1; // a has comma, prefer b
        if (!aHasComma && bHasComma) return -1; // b has comma, prefer a
        return 0;
      });
      
      // Keep first (no comma), delete rest
      const toKeep = items[0];
      const toDeleteFromGroup = items.slice(1);
      
      for (const item of toDeleteFromGroup) {
        stats.documentsToDelete++;
        stats.duplicateRevenue += Number(item.totalPrice || 0);
        
        if (toDelete.length < 20) {
          toDelete.push({
            firestoreDocId: item.firestoreDocId,
            soItemId: item.soItemId,
            soNumber: item.soNumber,
            totalPrice: item.totalPrice,
            salesPerson: item.salesPerson,
            reason: 'Has comma in soItemId',
            keeping: toKeep.firestoreDocId
          });
        }
        
        if (!dryRun) {
          batch.delete(item.docRef);
          batchCount++;
          
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`✅ Committed deletion batch of ${batchCount}`);
            batch = adminDb.batch();
            batchCount = 0;
          }
        }
      }
    }
    
    // Commit final batch
    if (!dryRun && batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final deletion batch of ${batchCount}`);
    }
    
    console.log('\n📊 DELETION STATS:');
    console.log(`   Duplicate Groups Found: ${stats.duplicateGroups}`);
    console.log(`   Documents to Delete: ${stats.documentsToDelete}`);
    console.log(`   Duplicate Revenue Removed: $${stats.duplicateRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`);
    
    return NextResponse.json({
      success: true,
      dryRun,
      month: targetMonth,
      stats,
      samplesToDelete: toDelete,
      message: dryRun 
        ? `Preview: Would delete ${stats.documentsToDelete} duplicate documents` 
        : `Deleted ${stats.documentsToDelete} duplicate documents successfully`
    });
    
  } catch (error: any) {
    console.error('Deletion error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
