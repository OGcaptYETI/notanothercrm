import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Delete all Fishbowl import data collections
 * WARNING: This will permanently delete all data in:
 * - fishbowl_sales_orders
 * - fishbowl_soitems
 * - fishbowl_customers
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🗑️  Starting Fishbowl data cleanup...');
    
    const collections = [
      'fishbowl_sales_orders',
      'fishbowl_soitems',
      'fishbowl_customers'
    ];
    
    const results: any = {};
    
    for (const collectionName of collections) {
      console.log(`\n📦 Deleting ${collectionName}...`);
      
      let deletedCount = 0;
      const batchSize = 500;
      
      while (true) {
        const snapshot = await adminDb.collection(collectionName)
          .limit(batchSize)
          .get();
        
        if (snapshot.empty) {
          break;
        }
        
        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedCount += snapshot.size;
        
        console.log(`   Deleted ${deletedCount} documents...`);
        
        if (snapshot.size < batchSize) {
          break;
        }
      }
      
      results[collectionName] = deletedCount;
      console.log(`✅ Deleted ${deletedCount} documents from ${collectionName}`);
    }
    
    console.log('\n✅ Cleanup complete!');
    console.log('Summary:', results);
    
    return NextResponse.json({
      success: true,
      message: 'Fishbowl data cleanup complete',
      results
    });
    
  } catch (error: any) {
    console.error('❌ Error during cleanup:', error);
    return NextResponse.json({ 
      error: error.message || 'Cleanup failed' 
    }, { status: 500 });
  }
}
