import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Authentication with Supabase
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify Supabase JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userEmail = user.email;
    const userId = user.id;

    console.log(`Fetching dashboard stats for user: ${userEmail}`);

    // Initialize stats
    const stats = {
      totalCustomers: 0,
      activeProspects: 0,
      pendingTasks: 0,
      monthlyOrders: 0,
      totalCalls: 0,
      totalEmails: 0,
      recentActivities: 0
    };

    // 1. Get customers assigned to this user
    try {
      const companiesRef = adminDb.collection('copper_companies');
      
      // Since Firestore doesn't support OR queries, we need to do two separate queries
      const userCompanies1 = await companiesRef
        .where('owner_id', '==', userId)
        .get();

      const userCompanies2 = await companiesRef
        .where('assigned_to', 'array-contains', userEmail)
        .get();

      // Combine results and deduplicate
      const allCompanies = new Map();
      [...userCompanies1.docs, ...userCompanies2.docs].forEach((doc: any) => {
        allCompanies.set(doc.id, doc.data());
      });

      stats.totalCustomers = allCompanies.size;

      // Count active prospects (companies without orders in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const prospectsQuery = await companiesRef
        .where('owner_id', '==', userId)
        .where('date_modified', '<', thirtyDaysAgo)
        .get();

      stats.activeProspects = prospectsQuery.size;
    } catch (error) {
      console.error('Error fetching customer stats:', error);
    }

    // 2. Get pending tasks from Copper
    try {
      const tasksRef = adminDb.collection('copper_tasks');
      const pendingTasks = await tasksRef
        .where('assigned_to', 'array-contains', userEmail)
        .where('status', '==', 'pending')
        .get();

      stats.pendingTasks = pendingTasks.size;
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }

    // 3. Get monthly orders
    try {
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      const ordersRef = adminDb.collection('fishbowl_sales_orders');
      const monthlyOrders = await ordersRef
        .where('salesPerson', '==', userEmail)
        .where('dateCreated', '>=', firstDayOfMonth)
        .get();

      stats.monthlyOrders = monthlyOrders.size;
    } catch (error) {
      console.error('Error fetching orders:', error);
    }

    // 4. Get call statistics from JustCall
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const justcallRef = adminDb.collection('justcall_activities');
      const userCalls = await justcallRef
        .where('user_email', '==', userEmail)
        .where('type', '==', 'call')
        .where('created_at', '>=', thirtyDaysAgo)
        .get();

      stats.totalCalls = userCalls.size;
    } catch (error) {
      console.error('Error fetching call stats:', error);
    }

    // 5. Get email statistics
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const emailRef = adminDb.collection('user_emails').doc(userId).collection('emails');
      const userEmails = await emailRef
        .where('date', '>=', thirtyDaysAgo)
        .get();

      stats.totalEmails = userEmails.size;
    } catch (error) {
      console.error('Error fetching email stats:', error);
    }

    // 6. Get recent activities count
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Count from all activity sources
      let recentCount = 0;

      // Copper activities
      const copperRef = adminDb.collection('copper_activities');
      const copperRecent = await copperRef
        .where('user_id', '==', userId)
        .where('activity_date', '>=', sevenDaysAgo)
        .get();
      recentCount += copperRecent.size;

      // JustCall activities
      const justcallRef = adminDb.collection('justcall_activities');
      const justcallRecent = await justcallRef
        .where('user_email', '==', userEmail)
        .where('created_at', '>=', sevenDaysAgo)
        .get();
      recentCount += justcallRecent.size;

      // Fishbowl orders
      const ordersRef = adminDb.collection('fishbowl_sales_orders');
      const ordersRecent = await ordersRef
        .where('salesPerson', '==', userEmail)
        .where('dateCreated', '>=', sevenDaysAgo)
        .get();
      recentCount += ordersRecent.size;

      stats.recentActivities = recentCount;
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
