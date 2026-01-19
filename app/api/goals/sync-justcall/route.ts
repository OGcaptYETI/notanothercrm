import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createJustCallClient } from '@/lib/justcall/client';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
    }

    // Create JustCall client
    const justCallClient = createJustCallClient();
    if (!justCallClient) {
      return NextResponse.json({ 
        error: 'JustCall API not configured. Please add JUSTCALL_API_KEY and JUSTCALL_API_SECRET to environment variables.' 
      }, { status: 500 });
    }

    // Get user's email from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userData = userDoc.data();
    const userEmail = userData?.email;
    
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    console.log(`[JustCall Sync] Fetching calls for ${userEmail} from ${startDate} to ${endDate}`);

    // Fetch calls from JustCall API
    const calls = await justCallClient.getCallsByUserEmail(
      userEmail,
      startDate,
      endDate
    );

    console.log(`[JustCall Sync] Found ${calls.length} calls for ${userEmail}`);

    // Aggregate calls by date
    const callsByDate = new Map<string, number>();
    const durationByDate = new Map<string, number>();

    calls.forEach(call => {
      const dateKey = call.call_date; // Already in YYYY-MM-DD format
      callsByDate.set(dateKey, (callsByDate.get(dateKey) || 0) + 1);
      
      // Track total talk time (conversation time, not total duration)
      const talkTime = call.call_duration?.conversation_time || 0;
      durationByDate.set(dateKey, (durationByDate.get(dateKey) || 0) + talkTime);
    });

    // Log metrics to goals system using adminDb
    const metricsLogged = [];
    
    // Log call quantity metrics
    for (const [dateStr, count] of callsByDate.entries()) {
      const metricRef = adminDb.collection('metrics').doc();
      await metricRef.set({
        id: metricRef.id,
        userId,
        type: 'phone_call_quantity',
        value: count,
        date: new Date(dateStr),
        source: 'justcall',
        metadata: { 
          syncDate: new Date().toISOString(),
          userEmail 
        },
        createdAt: FieldValue.serverTimestamp()
      });
      metricsLogged.push(metricRef.id);
    }

    // Log talk time metrics (in minutes)
    for (const [dateStr, seconds] of durationByDate.entries()) {
      const minutes = Math.round(seconds / 60);
      if (minutes > 0) {
        const metricRef = adminDb.collection('metrics').doc();
        await metricRef.set({
          id: metricRef.id,
          userId,
          type: 'talk_time_minutes',
          value: minutes,
          date: new Date(dateStr),
          source: 'justcall',
          metadata: { 
            syncDate: new Date().toISOString(),
            userEmail,
            totalSeconds: seconds
          },
          createdAt: FieldValue.serverTimestamp()
        });
        metricsLogged.push(metricRef.id);
      }
    }

    // Calculate total talk time
    const totalTalkTimeSeconds = Array.from(durationByDate.values()).reduce((sum, val) => sum + val, 0);
    const totalTalkTimeMinutes = Math.round(totalTalkTimeSeconds / 60);

    return NextResponse.json({
      success: true,
      totalCalls: calls.length,
      totalTalkTimeMinutes,
      metricsLogged: metricsLogged.length,
      dateRange: {
        start: startDate,
        end: endDate
      },
      callsByDate: Object.fromEntries(callsByDate)
    });
  } catch (error: any) {
    console.error('Error syncing JustCall metrics:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to sync JustCall data',
      details: error.toString()
    }, { status: 500 });
  }
}
