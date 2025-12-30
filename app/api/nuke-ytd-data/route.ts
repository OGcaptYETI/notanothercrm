import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * NUCLEAR OPTION: Delete all 2025 commission and order data for clean reimport
 * 
 * Query params:
 * - collections: comma-separated list of collections to nuke
 *   Options: monthly_commissions, monthly_commission_summary, fishbowl_sales_orders
 *   Example: ?collections=monthly_commissions,monthly_commission_summary
 * 
 * - year: year to delete (default: 2025)
 * 
 * SAFETY: Requires confirmation=true query param to actually delete
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const confirmation = searchParams.get('confirmation') === 'true';
    const collectionsParam = searchParams.get('collections') || 'monthly_commissions,monthly_commission_summary';
    const year = parseInt(searchParams.get('year') || '2025');
    
    const collections = collectionsParam.split(',').map(c => c.trim());
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚨 NUCLEAR OPTION: Delete ${year} Data`);
    console.log(`${'='.repeat(80)}\n`);
    
    if (!confirmation) {
      console.log('⚠️  DRY RUN MODE - No data will be deleted');
      console.log('   Add ?confirmation=true to actually delete data\n');
    }
    
    const results: any = {
      dryRun: !confirmation,
      year,
      collections: {},
      totalDeleted: 0
    };
    
    // Process each collection
    for (const collectionName of collections) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📦 Processing: ${collectionName}`);
      console.log(`${'='.repeat(80)}\n`);
      
      let deletedCount = 0;
      
      if (collectionName === 'monthly_commissions') {
        // Delete all monthly_commissions for the year
        deletedCount = await deleteByYear(collectionName, 'commissionMonth', year, confirmation);
      } else if (collectionName === 'monthly_commission_summary') {
        // Delete all monthly_commission_summary for the year
        deletedCount = await deleteByYear(collectionName, 'month', year, confirmation);
      } else if (collectionName === 'fishbowl_sales_orders') {
        // Delete all fishbowl_sales_orders for the year
        deletedCount = await deleteSalesOrdersByYear(year, confirmation);
      } else {
        console.log(`⚠️  Unknown collection: ${collectionName}`);
        continue;
      }
      
      results.collections[collectionName] = deletedCount;
      results.totalDeleted += deletedCount;
      
      console.log(`\n✅ ${collectionName}: ${deletedCount} documents ${confirmation ? 'deleted' : 'would be deleted'}`);
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SUMMARY`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`Total documents ${confirmation ? 'deleted' : 'that would be deleted'}: ${results.totalDeleted}`);
    
    if (!confirmation) {
      console.log(`\n⚠️  THIS WAS A DRY RUN - No data was actually deleted`);
      console.log(`   To actually delete, add: ?confirmation=true`);
    } else {
      console.log(`\n✅ Data successfully deleted`);
      console.log(`   Next steps:`);
      console.log(`   1. Reimport Fishbowl data for ${year}`);
      console.log(`   2. Recalculate commissions for each month`);
    }
    
    console.log(`\n${'='.repeat(80)}\n`);
    
    return NextResponse.json({
      success: true,
      ...results
    });
    
  } catch (error: any) {
    console.error('Error nuking YTD data:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function deleteByYear(
  collectionName: string,
  dateField: string,
  year: number,
  actuallyDelete: boolean
): Promise<number> {
  let totalDeleted = 0;
  const batchSize = 450;
  
  // For monthly_commissions: commissionMonth format is "YYYY-MM"
  // For monthly_commission_summary: month format is "YYYY-MM"
  const yearPrefix = `${year}-`;
  
  console.log(`🔍 Querying ${collectionName} for ${year} data...`);
  
  // Query all documents for the year
  const query = adminDb.collection(collectionName)
    .where(dateField, '>=', `${year}-01`)
    .where(dateField, '<=', `${year}-12`);
  
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  
  for (;;) {
    let q = query.limit(batchSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    
    const snap = await q.get();
    if (snap.empty) break;
    
    console.log(`   Found ${snap.size} documents in this batch...`);
    
    if (actuallyDelete) {
      const batch = adminDb.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`   ✅ Deleted ${snap.size} documents`);
    } else {
      console.log(`   ℹ️  Would delete ${snap.size} documents (dry run)`);
    }
    
    totalDeleted += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    
    if (snap.size < batchSize) break;
  }
  
  return totalDeleted;
}

async function deleteSalesOrdersByYear(
  year: number,
  actuallyDelete: boolean
): Promise<number> {
  let totalDeleted = 0;
  const batchSize = 450;
  
  console.log(`🔍 Querying fishbowl_sales_orders for ${year} data...`);
  
  // Query by postingDate timestamp
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31T23:59:59`);
  
  const query = adminDb.collection('fishbowl_sales_orders')
    .where('postingDate', '>=', startDate)
    .where('postingDate', '<=', endDate);
  
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  
  for (;;) {
    let q = query.limit(batchSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    
    const snap = await q.get();
    if (snap.empty) break;
    
    console.log(`   Found ${snap.size} orders in this batch...`);
    
    if (actuallyDelete) {
      const batch = adminDb.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`   ✅ Deleted ${snap.size} orders`);
    } else {
      console.log(`   ℹ️  Would delete ${snap.size} orders (dry run)`);
    }
    
    totalDeleted += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    
    if (snap.size < batchSize) break;
  }
  
  return totalDeleted;
}
