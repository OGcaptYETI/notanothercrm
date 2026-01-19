import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createJustCallClient } from '@/lib/justcall/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
    }

    // Create JustCall client
    const justCallClient = createJustCallClient();
    if (!justCallClient) {
      return NextResponse.json({ 
        error: 'JustCall API not configured' 
      }, { status: 500 });
    }

    // Determine which period to fetch based on date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    let period = 'monthly'; // default
    
    // Check if it's a weekly range (7 days)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 7) {
      period = 'weekly';
    } else if (daysDiff >= 80) {
      period = 'quarterly';
    }

    console.log(`[Team Metrics] Fetching ${period} metrics for date range: ${startDate} to ${endDate}`);

    // Get all users
    const usersSnapshot = await adminDb
      .collection('users')
      .get();

    console.log(`[Team Metrics] Found ${usersSnapshot.size} users in Firestore`);

    const teamMetrics = [];

    // Fetch cached metrics for each user
    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();
      const email = user.email;
      
      if (!email) {
        console.log(`[Team Metrics] Skipping user ${userDoc.id} - no email`);
        continue;
      }

      console.log(`[Team Metrics] Processing user: ${email}`);

      try {
        // Fetch metrics from Firestore cache
        const metricsDoc = await adminDb
          .collection('users')
          .doc(userDoc.id)
          .collection('metrics')
          .doc('justcall')
          .collection(period)
          .doc('current')
          .get();

        if (!metricsDoc.exists) {
          console.log(`[Team Metrics] No cached metrics for ${email} - skipping`);
          continue;
        }

        const metrics = metricsDoc.data();
        
        const memberMetric = {
          userId: userDoc.id,
          name: user.name || email.split('@')[0],
          email: email,
          calls: metrics?.totalCalls || 0,
          inbound: metrics?.inboundCalls || 0,
          outbound: metrics?.outboundCalls || 0,
          completed: metrics?.completedCalls || 0,
          missed: metrics?.missedCalls || 0,
          talkTime: metrics?.totalDuration || 0,
          avgDuration: metrics?.averageDuration || 0,
          connectionRate: metrics?.connectionRate || 0,
          trend: metrics?.trend || 'stable',
          previousPeriodCalls: metrics?.previousPeriodCalls || 0,
          change: metrics?.change || 0,
          changePercent: metrics?.changePercent || 0
        };
        
        teamMetrics.push(memberMetric);
        console.log(`[Team Metrics] Added ${email}: ${metrics?.totalCalls || 0} calls (cached)`);
      } catch (error) {
        console.error(`[Team Metrics] Error fetching metrics for ${email}:`, error);
        // Continue with other users
      }
    }

    console.log(`[Team Metrics] Total team members processed: ${teamMetrics.length}`);

    // Sort by total calls descending
    teamMetrics.sort((a, b) => b.calls - a.calls);

    // Calculate team totals
    const teamTotals = {
      totalCalls: teamMetrics.reduce((sum, m) => sum + m.calls, 0),
      totalInbound: teamMetrics.reduce((sum, m) => sum + m.inbound, 0),
      totalOutbound: teamMetrics.reduce((sum, m) => sum + m.outbound, 0),
      totalCompleted: teamMetrics.reduce((sum, m) => sum + m.completed, 0),
      totalMissed: teamMetrics.reduce((sum, m) => sum + m.missed, 0),
      totalTalkTime: teamMetrics.reduce((sum, m) => sum + m.talkTime, 0),
      avgConnectionRate: teamMetrics.length > 0
        ? Math.round(teamMetrics.reduce((sum, m) => sum + m.connectionRate, 0) / teamMetrics.length)
        : 0,
      memberCount: teamMetrics.length
    };

    return NextResponse.json({
      success: true,
      teamMetrics,
      teamTotals,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
  } catch (error: any) {
    console.error('Error fetching team metrics:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch team metrics',
      details: error.toString()
    }, { status: 500 });
  }
}
