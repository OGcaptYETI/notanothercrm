import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, parseISO, isWithinInterval } from 'date-fns';

export const runtime = 'nodejs';

/**
 * GET /api/justcall/metrics
 * Get call metrics for a user
 * Query params:
 *   - email: User email (required)
 *   - start_date: YYYY-MM-DD (optional)
 *   - end_date: YYYY-MM-DD (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!email || !startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Missing required parameters: email, start_date, end_date' 
      }, { status: 400 });
    }

    // Determine which period to fetch based on date range
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const now = new Date();
    
    let period = 'monthly'; // default
    
    // Check if it's a weekly range (7 days)
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    if (isWithinInterval(start, { start: weekStart, end: weekEnd })) {
      period = 'weekly';
    }
    
    // Check if it's a monthly range
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    if (isWithinInterval(start, { start: monthStart, end: monthEnd })) {
      period = 'monthly';
    }
    
    // Check if it's a quarterly range
    const quarterStart = startOfQuarter(now);
    const quarterEnd = endOfQuarter(now);
    if (isWithinInterval(start, { start: quarterStart, end: quarterEnd })) {
      period = 'quarterly';
    }

    // Fetch metrics from Firestore cache
    const metricsDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('metrics')
      .doc('justcall')
      .collection(period)
      .doc('current')
      .get();

    if (!metricsDoc.exists) {
      return NextResponse.json({ 
        error: 'Metrics not found. Please sync metrics first.',
        needsSync: true
      }, { status: 404 });
    }

    const metrics = metricsDoc.data();

    return NextResponse.json({
      success: true,
      email: email,
      dateRange: { start: startDate, end: endDate },
      period: period,
      metrics: metrics,
      cached: true
    });

  } catch (error) {
    console.error('Error fetching JustCall metrics:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch metrics' 
    }, { status: 500 });
  }
}
