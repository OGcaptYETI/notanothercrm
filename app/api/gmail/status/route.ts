import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await verifyIdToken(token);
    
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;

    // Get Gmail connection status
    const connectionDoc = await adminDb.collection('gmail_connections').doc(userId).get();
    
    if (!connectionDoc.exists) {
      return NextResponse.json({
        connected: false,
        needsReauth: false,
        message: 'Gmail not connected'
      });
    }

    const connectionData = connectionDoc.data();
    const connectedAt = connectionData?.connectedAt?.toDate();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const isExpired = connectedAt && connectedAt < thirtyDaysAgo;
    const needsReauth = connectionData?.needsReauth || isExpired;

    return NextResponse.json({
      connected: connectionData?.status === 'connected' && !isExpired,
      needsReauth,
      connectedAt: connectionData?.connectedAt,
      lastSyncAt: connectionData?.lastSyncAt,
      message: needsReauth 
        ? 'Please reconnect your Gmail account for security (30-day policy)'
        : 'Gmail is connected and syncing'
    });

  } catch (error) {
    console.error('Error checking Gmail status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
