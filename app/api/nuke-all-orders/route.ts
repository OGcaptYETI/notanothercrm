import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * COMPLETE NUCLEAR OPTION: Delete ALL orders and line items (all years)
 * 
 * This deletes EVERYTHING from fishbowl_sales_orders and fishbowl_soitems
 * regardless of year. Use this for a complete clean slate rebuild.
 * 
 * Query params:
 * - confirmation: Must be "true" to actually delete (default: dry run)
 * 
 * Examples:
 * - Dry run: POST /api/nuke-all-orders
 * - Actually delete: POST /api/nuke-all-orders?confirmation=true
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const confirmation = searchParams.get('confirmation') === 'true';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚨 COMPLETE NUCLEAR OPTION: Delete ALL Orders & Line Items`);
    console.log(`${'='.repeat(80)}\n`);
    
    if (!confirmation) {
      console.log('⚠️  DRY RUN MODE - No data will be deleted');
      console.log('   Add ?confirmation=true to actually delete data\n');
    }
    
    const results: any = {
      dryRun: !confirmation,
      collections: {},
      totalDeleted: 0
    };
    
    // Delete fishbowl_sales_orders
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📦 Processing: fishbowl_sales_orders`);
    console.log(`${'='.repeat(80)}\n`);
    
    const ordersDeleted = await deleteAllFromCollection('fishbowl_sales_orders', confirmation);
    results.collections['fishbowl_sales_orders'] = ordersDeleted;
    results.totalDeleted += ordersDeleted;
    
    console.log(`\n✅ fishbowl_sales_orders: ${ordersDeleted} documents ${confirmation ? 'deleted' : 'would be deleted'}`);
    
    // Delete fishbowl_soitems
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📦 Processing: fishbowl_soitems`);
    console.log(`${'='.repeat(80)}\n`);
    
    const itemsDeleted = await deleteAllFromCollection('fishbowl_soitems', confirmation);
    results.collections['fishbowl_soitems'] = itemsDeleted;
    results.totalDeleted += itemsDeleted;
    
    console.log(`\n✅ fishbowl_soitems: ${itemsDeleted} documents ${confirmation ? 'deleted' : 'would be deleted'}`);
    
    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SUMMARY`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`Total documents ${confirmation ? 'deleted' : 'that would be deleted'}: ${results.totalDeleted}`);
    console.log(`   fishbowl_sales_orders: ${ordersDeleted}`);
    console.log(`   fishbowl_soitems: ${itemsDeleted}`);
    
    if (!confirmation) {
      console.log(`\n⚠️  THIS WAS A DRY RUN - No data was actually deleted`);
      console.log(`   To actually delete, add: ?confirmation=true`);
      console.log(`\n⚠️  WARNING: This will delete ALL orders from ALL years!`);
      console.log(`   Make sure you have Fishbowl CSV exports ready to reimport.`);
    } else {
      console.log(`\n✅ Data successfully deleted`);
      console.log(`\n📋 Next steps:`);
      console.log(`   1. Import Fishbowl CSV files for all years (2022-2025)`);
      console.log(`   2. Go to Settings → Data & Sync → Fishbowl Import`);
      console.log(`   3. Upload each CSV file one by one`);
      console.log(`   4. After all imports complete, recalculate commissions`);
      console.log(`   5. Settings → Commissions → Calculate for each month`);
    }
    
    console.log(`\n${'='.repeat(80)}\n`);
    
    return NextResponse.json({
      success: true,
      ...results
    });
    
  } catch (error: any) {
    console.error('Error nuking all orders:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function deleteAllFromCollection(
  collectionName: string,
  actuallyDelete: boolean
): Promise<number> {
  let totalDeleted = 0;
  const batchSize = 450;
  
  console.log(`🔍 Querying ${collectionName} for ALL documents...`);
  
  for (;;) {
    // Get a batch of documents (no filters - delete everything)
    const snap = await adminDb.collection(collectionName)
      .limit(batchSize)
      .get();
    
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
    
    // If we got fewer than batchSize, we're done
    if (snap.size < batchSize) break;
  }
  
  console.log(`\n📊 Total in ${collectionName}: ${totalDeleted} documents`);
  
  return totalDeleted;
}
