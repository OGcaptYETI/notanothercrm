import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { verifyIdToken, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'}/api/gmail/callback`
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This contains the user ID
    const error = searchParams.get('error');

    if (error) {
      console.error('Gmail OAuth error:', error);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
      return NextResponse.redirect(`${baseUrl}/dashboard?error=gmail_auth_failed`);
    }

    if (!code || !state) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
      return NextResponse.redirect(`${baseUrl}/dashboard?error=invalid_callback`);
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
      return NextResponse.redirect(`${baseUrl}/dashboard?error=no_access_token`);
    }
    
    // Store tokens securely
    await adminDb.collection('gmail_connections').doc(state).set({
      userId: state,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      status: 'connected',
      connectedAt: new Date(),
      lastRefreshed: new Date(),
      needsReauth: false,
      updatedAt: new Date()
    }, { merge: true });

    // Start initial email sync
    await syncEmails(state, tokens.access_token);

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'}/dashboard?success=gmail_connected`);

  } catch (error) {
    console.error('Gmail callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'}/dashboard?error=gmail_callback_failed`);
  }
}

async function syncEmails(userId: string, accessToken: string) {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Get recent emails (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${Math.floor(thirtyDaysAgo.getTime() / 1000)}`,
      maxResults: 100
    });

    // Get user's customers for matching
    const customersRef = adminDb.collection('customers');
    const userCustomers = await customersRef
      .where('assignedTo', '==', userId)
      .get();
    
    // Create email-to-customer map
    const customerEmailMap = new Map<string, { id: string; name: string; company?: string }>();
    userCustomers.docs.forEach((doc: any) => {
      const data = doc.data();
      const email = data.email || data.contactEmail;
      if (email) {
        customerEmailMap.set(email.toLowerCase(), {
          id: doc.id,
          name: data.name || data.contactName,
          company: data.company
        });
      }
    });

    if (response.data.messages) {
      const emailsRef = adminDb.collection('user_emails').doc(userId).collection('emails');
      
      for (const message of response.data.messages) {
        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date']
          });

          const headers = fullMessage.data.payload?.headers || [];
          const fromHeader = headers.find((h: any) => h.name === 'From');
          const toHeader = headers.find((h: any) => h.name === 'To');
          const subjectHeader = headers.find((h: any) => h.name === 'Subject');
          const dateHeader = headers.find((h: any) => h.name === 'Date');

          // Extract email addresses
          const fromEmail = fromHeader?.value?.match(/<(.+)>/)?.[1] || fromHeader?.value?.split(' ').pop();
          const toEmails = toHeader?.value?.match(/<(.+)>/g)?.map((email: string) => email.slice(1, -1)) || [toHeader?.value];

          // Check if email matches any customer
          let matchedCustomer = null;
          let direction = 'received';

          // Check if sent to customer
          if (toEmails && toEmails.length > 0) {
            for (const toEmail of toEmails) {
              if (toEmail) {
                const cleanEmail = toEmail.toLowerCase().trim();
                if (customerEmailMap.has(cleanEmail)) {
                  matchedCustomer = customerEmailMap.get(cleanEmail);
                  direction = 'sent';
                  break;
                }
              }
            }
          }

          // Check if received from customer
          if (!matchedCustomer && fromEmail) {
            const cleanFromEmail = fromEmail.toLowerCase().trim();
            matchedCustomer = customerEmailMap.get(cleanFromEmail);
            direction = 'received';
          }

          // Only store emails that match customers
          if (matchedCustomer) {
            const emailData = {
              id: message.id,
              from: fromHeader?.value || '',
              to: toHeader?.value || '',
              subject: subjectHeader?.value || '(No Subject)',
              date: new Date(dateHeader?.value || Date.now()),
              direction,
              snippet: fullMessage.data.snippet || '',
              customerId: matchedCustomer.id,
              customerName: matchedCustomer.name,
              customerCompany: matchedCustomer.company,
              syncedAt: new Date()
            };

            // Store email in Firestore
            await emailsRef.doc(message.id!).set(emailData, { merge: true });
          }
        } catch (error) {
          console.error(`Error syncing email ${message.id}:`, error);
        }
      }
    }

    // Update last sync time
    await adminDb.collection('gmail_connections').doc(userId).update({
      lastSyncAt: new Date()
    });

  } catch (error) {
    console.error('Error syncing emails:', error);
  }
}
