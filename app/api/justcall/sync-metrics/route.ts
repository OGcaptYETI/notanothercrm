import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createJustCallClient } from '@/lib/justcall/client';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    const userEmail = userData.email;

    // Create JustCall client
    const justCallClient = createJustCallClient();
    if (!justCallClient) {
      return NextResponse.json({ 
        error: 'JustCall API not configured' 
      }, { status: 500 });
    }

    const now = new Date();
    const periods = [
      {
        name: 'weekly',
        start: startOfWeek(now),
        end: endOfWeek(now),
        prevStart: startOfWeek(subMonths(now, 1)),
        prevEnd: endOfWeek(subMonths(now, 1))
      },
      {
        name: 'monthly',
        start: startOfMonth(now),
        end: endOfMonth(now),
        prevStart: startOfMonth(subMonths(now, 1)),
        prevEnd: endOfMonth(subMonths(now, 1))
      },
      {
        name: 'quarterly',
        start: startOfQuarter(now),
        end: endOfQuarter(now),
        prevStart: startOfQuarter(subMonths(now, 3)),
        prevEnd: endOfQuarter(subMonths(now, 3))
      }
    ];

    const results = [];

    // Sync metrics for each period
    for (const period of periods) {
      try {
        // Fetch current period calls
        const calls = await justCallClient.getCallsByUserEmail(
          userEmail,
          period.start.toISOString().split('T')[0],
          period.end.toISOString().split('T')[0]
        );

        // Fetch previous period calls for trend
        const prevCalls = await justCallClient.getCallsByUserEmail(
          userEmail,
          period.prevStart.toISOString().split('T')[0],
          period.prevEnd.toISOString().split('T')[0]
        );

        // Calculate metrics
        const metrics = justCallClient.calculateMetrics(calls);
        const prevMetrics = justCallClient.calculateMetrics(prevCalls);

        // Calculate trend
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (metrics.totalCalls > prevMetrics.totalCalls * 1.1) trend = 'up';
        else if (metrics.totalCalls < prevMetrics.totalCalls * 0.9) trend = 'down';

        // Store in Firestore: users/{userId}/metrics/justcall/{period}
        const metricsData = {
          totalCalls: metrics.totalCalls,
          inboundCalls: metrics.inboundCalls,
          outboundCalls: metrics.outboundCalls,
          completedCalls: metrics.completedCalls,
          missedCalls: metrics.missedCalls,
          totalDuration: metrics.totalDuration,
          averageDuration: metrics.averageDuration,
          connectionRate: metrics.totalCalls > 0 
            ? Math.round((metrics.completedCalls / metrics.totalCalls) * 100) 
            : 0,
          callsByDay: metrics.callsByDay,
          callsByStatus: metrics.callsByStatus,
          trend: trend,
          previousPeriodCalls: prevMetrics.totalCalls,
          change: metrics.totalCalls - prevMetrics.totalCalls,
          changePercent: prevMetrics.totalCalls > 0
            ? Math.round(((metrics.totalCalls - prevMetrics.totalCalls) / prevMetrics.totalCalls) * 100)
            : 0,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          lastUpdated: new Date().toISOString(),
          userEmail: userEmail
        };

        await adminDb
          .collection('users')
          .doc(userId)
          .collection('metrics')
          .doc('justcall')
          .collection(period.name)
          .doc('current')
          .set(metricsData);

        results.push({
          period: period.name,
          success: true,
          metrics: metricsData
        });

        console.log(`[Sync Metrics] Updated ${period.name} for ${userEmail}: ${metrics.totalCalls} calls`);
      } catch (error) {
        console.error(`[Sync Metrics] Error syncing ${period.name} for ${userEmail}:`, error);
        results.push({
          period: period.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      userId: userId,
      email: userEmail,
      results: results,
      syncedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Sync Metrics] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to sync metrics' 
    }, { status: 500 });
  }
}
