import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get user's Gmail connection
    const connectionDoc = await adminDb.collection('gmail_connections').doc(userId).get();
    
    if (!connectionDoc.exists) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 404 });
    }

    const connectionData = connectionDoc.data();
    
    // Check if connection is still valid (30 days)
    const connectedAt = connectionData?.connectedAt?.toDate();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (connectedAt && connectedAt < thirtyDaysAgo) {
      // Force reconnection after 30 days
      await adminDb.collection('gmail_connections').doc(userId).update({
        status: 'expired',
        needsReauth: true
      });
      
      return NextResponse.json({ 
        error: 'Connection expired', 
        needsReauth: true,
        message: 'Please reconnect your Gmail account for security'
      }, { status: 401 });
    }

    // Check if we need to refresh the access token
    const tokenExpiry = connectionData?.tokenExpiry?.toDate();
    const now = new Date();
    
    if (tokenExpiry && tokenExpiry <= now && connectionData?.refreshToken) {
      // Refresh the access token
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID!,
        process.env.GMAIL_CLIENT_SECRET!
      );
      
      oauth2Client.setCredentials({
        refresh_token: connectionData.refreshToken
      });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update the tokens
      await adminDb.collection('gmail_connections').doc(userId).update({
        accessToken: credentials.access_token,
        tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        lastRefreshed: new Date()
      });
      
      return NextResponse.json({
        success: true,
        message: 'Token refreshed successfully'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Connection is still valid'
    });

  } catch (error) {
    console.error('Error refreshing Gmail token:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
