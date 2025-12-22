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

    // Get user's email to filter activities
    const userEmail = decodedToken.email;
    const userId = decodedToken.uid;

    console.log(`Fetching activities for user: ${userEmail}`);

    // Fetch activities from multiple sources
    const activities: any[] = [];

    // 1. Get Copper CRM activities for this user
    try {
      const activitiesRef = adminDb.collection('copper_activities');
      
      // Since Firestore doesn't support OR queries, we need to do two separate queries
      const userActivities1 = await activitiesRef
        .where('user_id', '==', userId)
        .orderBy('activity_date', 'desc')
        .limit(50)
        .get();

      const userActivities2 = await activitiesRef
        .where('assigned_to', 'array-contains', userEmail)
        .orderBy('activity_date', 'desc')
        .limit(50)
        .get();

      // Combine results
      const allActivities = [...userActivities1.docs, ...userActivities2.docs];
      
      allActivities.forEach((doc: any) => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: data.type || 'note',
          title: data.details || 'Activity',
          description: data.activity_type || 'CRM Activity',
          contact: data.person_name || data.company_name,
          company: data.company_name,
          timestamp: data.activity_date?.toDate() || new Date(),
          user: userEmail,
          source: 'copper'
        });
      });
    } catch (error) {
      console.error('Error fetching Copper activities:', error);
    }

    // 2. Get JustCall activities (calls, SMS)
    try {
      const justcallRef = adminDb.collection('justcall_activities');
      const callActivities = await justcallRef
        .where('user_email', '==', userEmail)
        .orderBy('created_at', 'desc')
        .limit(50)
        .get();

      callActivities.docs.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: data.type === 'call' ? 'call' : 'sms',
          title: data.type === 'call' ? `Call with ${data.contact_name}` : `SMS to ${data.contact_name}`,
          description: data.type === 'call' ? 
            `${data.call_status === 'answered' ? 'Incoming' : 'Outgoing'} Call (${data.duration}s)` :
            data.text_content?.substring(0, 100) + '...',
          contact: data.contact_name,
          company: data.company_name,
          timestamp: data.created_at?.toDate() || new Date(),
          user: userEmail,
          source: 'justcall'
        });
      });
    } catch (error) {
      console.error('Error fetching JustCall activities:', error);
    }

    // 3. Get Fishbowl orders
    try {
      const ordersRef = adminDb.collection('fishbowl_sales_orders');
      const userOrders = await ordersRef
        .where('salesPerson', '==', userEmail)
        .orderBy('dateCreated', 'desc')
        .limit(20)
        .get();

      userOrders.docs.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: 'order',
          title: `Order ${data.number}`,
          description: `${data.customer} - ${data.status}`,
          contact: data.customer,
          company: data.customer,
          timestamp: data.dateCreated?.toDate() || new Date(),
          user: userEmail,
          source: 'fishbowl'
        });
      });
    } catch (error) {
      console.error('Error fetching Fishbowl orders:', error);
    }

    // 4. Get email activities (if Gmail is connected)
    try {
      const emailRef = adminDb.collection('user_emails').doc(userId).collection('emails');
      const emails = await emailRef
        .orderBy('date', 'desc')
        .limit(50)
        .get();

      emails.docs.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: 'email',
          title: `Email ${data.direction === 'sent' ? 'to' : 'from'} ${data.to || data.from}`,
          description: data.subject,
          contact: data.to?.[0]?.split('@')[0] || data.from?.split('@')[0],
          company: data.company_name,
          timestamp: data.date?.toDate() || new Date(),
          user: userEmail,
          source: 'gmail'
        });
      });
    } catch (error) {
      console.error('Error fetching emails:', error);
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return NextResponse.json({
      success: true,
      data: activities.slice(0, 100) // Limit to 100 most recent
    });

  } catch (error) {
    console.error('Error fetching dashboard activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
