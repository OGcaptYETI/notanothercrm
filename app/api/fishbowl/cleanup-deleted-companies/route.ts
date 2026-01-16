import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting cleanup of deleted Copper companies...');

    // Get all error records from staging
    const stagingSnapshot = await adminDb
      .collection('fishbowl_metrics_staging')
      .where('status', '==', 'error')
      .get();

    console.log(`Found ${stagingSnapshot.size} error records in staging`);

    let deletedFromCopper = 0;
    let deletedFromStaging = 0;

    const batch = adminDb.batch();
    let batchCount = 0;
    const MAX_BATCH = 500;

    for (const doc of stagingSnapshot.docs) {
      const data = doc.data();
      const copperCompanyId = data.copperCompanyId;

      // Only delete if error is 404 (company not found in Copper)
      if (data.syncError && data.syncError.includes('404')) {
        // Delete from copper_companies collection
        const copperRef = adminDb.collection('copper_companies').doc(copperCompanyId);
        batch.delete(copperRef);
        deletedFromCopper++;

        // Delete from staging
        batch.delete(doc.ref);
        deletedFromStaging++;

        batchCount++;

        // Commit in batches of 500
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          console.log(`✅ Committed batch of ${batchCount} deletions`);
          batchCount = 0;
        }
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} deletions`);
    }

    console.log(`✅ Cleanup complete!`);
    console.log(`   Deleted from copper_companies: ${deletedFromCopper}`);
    console.log(`   Deleted from staging: ${deletedFromStaging}`);

    return NextResponse.json({
      success: true,
      stats: {
        deletedFromCopper,
        deletedFromStaging,
      },
    });

  } catch (error: any) {
    console.error('❌ Error during cleanup:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
