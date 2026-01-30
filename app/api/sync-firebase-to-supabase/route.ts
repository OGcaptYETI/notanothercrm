import { NextRequest, NextResponse } from 'next/server';
import { syncCustomersToSupabase, getSyncStatus } from '@/lib/services/firebase-to-supabase-sync';

export const dynamic = 'force-dynamic';

/**
 * Manual sync endpoint for Firebase → Supabase
 * POST /api/sync-firebase-to-supabase
 * 
 * Body: {
 *   companyId?: string,  // defaults to 'kanva-botanicals'
 *   dryRun?: boolean     // if true, only returns status without syncing
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId = 'kanva-botanicals', dryRun = false } = body;

    // If dry run, just return sync status
    if (dryRun) {
      const status = await getSyncStatus(companyId);
      return NextResponse.json({
        success: true,
        dryRun: true,
        status
      });
    }

    // Perform actual sync
    console.log(`🔄 Starting manual Firebase → Supabase sync for company: ${companyId}`);
    
    const result = await syncCustomersToSupabase(companyId);

    return NextResponse.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors,
      summary: result.summary
    });

  } catch (error: any) {
    console.error('❌ Sync API error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * Get sync status
 * GET /api/sync-firebase-to-supabase
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId') || 'kanva-botanicals';

    const status = await getSyncStatus(companyId);

    return NextResponse.json({
      success: true,
      status
    });

  } catch (error: any) {
    console.error('❌ Sync status API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
