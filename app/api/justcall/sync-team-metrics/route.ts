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
    
    // Check if user is admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (userData?.role !== 'admin' && userData?.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

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

    // Fetch JustCall users list ONCE to avoid rate limiting
    console.log('[Sync Team] Fetching JustCall users list...');
    const justCallUsers = await justCallClient.getUsers();
    console.log(`[Sync Team] Found ${justCallUsers.length} JustCall users`);
    
    // Create email to agent_id map
    const emailToAgentId = new Map<string, number>();
    justCallUsers.forEach(jcUser => {
      if (jcUser.email && jcUser.id) {
        emailToAgentId.set(jcUser.email.toLowerCase(), jcUser.id);
      }
    });

    // Get all users from Firestore
    const usersSnapshot = await adminDb.collection('users').get();
    console.log(`[Sync Team] Found ${usersSnapshot.size} Firestore users to sync`);

    const userResults = [];

    // Sync metrics for each user
    for (const userDocSnap of usersSnapshot.docs) {
      const user = userDocSnap.data();
      const userEmail = user.email;
      
      if (!userEmail) {
        console.log(`[Sync Team] Skipping user ${userDocSnap.id} - no email`);
        continue;
      }

      // Get agent_id from cached map
      const agentId = emailToAgentId.get(userEmail.toLowerCase());
      if (!agentId) {
        console.log(`[Sync Team] Skipping ${userEmail} - not found in JustCall`);
        continue;
      }

      console.log(`[Sync Team] Syncing metrics for ${userEmail} (Agent ID: ${agentId})`);
      const periodResults = [];

      // Sync each period for this user
      for (const period of periods) {
        try {
          // Fetch current period calls using agent_id directly
          const calls = await justCallClient.getCallsByAgentId(
            agentId,
            period.start.toISOString().split('T')[0],
            period.end.toISOString().split('T')[0]
          );

          // Fetch previous period calls for trend
          const prevCalls = await justCallClient.getCallsByAgentId(
            agentId,
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

          // Store in Firestore
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
            .doc(userDocSnap.id)
            .collection('metrics')
            .doc('justcall')
            .collection(period.name)
            .doc('current')
            .set(metricsData);

          periodResults.push({
            period: period.name,
            success: true,
            calls: metrics.totalCalls
          });

          console.log(`[Sync Team] ${userEmail} - ${period.name}: ${metrics.totalCalls} calls`);
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`[Sync Team] Error syncing ${period.name} for ${userEmail}:`, error);
          periodResults.push({
            period: period.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      userResults.push({
        userId: userDocSnap.id,
        email: userEmail,
        periods: periodResults
      });
    }

    return NextResponse.json({
      success: true,
      totalUsers: usersSnapshot.size,
      syncedUsers: userResults.length,
      results: userResults,
      syncedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Sync Team] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to sync team metrics' 
    }, { status: 500 });
  }
}
