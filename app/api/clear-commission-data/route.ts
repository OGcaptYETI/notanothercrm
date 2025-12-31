import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function deleteCollection(collectionPath: string, batchSize: number = 500) {
  const collectionRef = adminDb.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(
  query: FirebaseFirestore.Query,
  resolve: (value?: unknown) => void,
  reject: (reason?: any) => void
) {
  try {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
      resolve();
      return;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${snapshot.size} documents`);

    // Recurse on the next batch
    process.nextTick(() => {
      deleteQueryBatch(query, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { confirm } = await req.json();
    
    if (confirm !== 'DELETE_COMMISSION_DATA') {
      return NextResponse.json({ 
        error: 'Confirmation required. Send { "confirm": "DELETE_COMMISSION_DATA" }' 
      }, { status: 400 });
    }

    console.log('\n🗑️  STARTING COMMISSION DATA DELETION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const startTime = Date.now();
    
    // Delete monthly_commissions collection
    console.log('\n📦 Step 1: Deleting monthly_commissions collection...');
    await deleteCollection('monthly_commissions');
    
    // Delete commission_entries collection
    console.log('\n📦 Step 2: Deleting commission_entries collection...');
    await deleteCollection('commission_entries');
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n✅ COMMISSION DATA DELETION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration} seconds`);
    
    return NextResponse.json({
      success: true,
      message: 'Commission data deleted successfully',
      duration: `${duration} seconds`,
      collectionsDeleted: [
        'monthly_commissions',
        'commission_entries'
      ]
    });
    
  } catch (error: any) {
    console.error('❌ Deletion error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
