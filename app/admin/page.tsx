'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, Users, Target, Database, Phone, FileText, DollarSign, Sliders, Plug, BarChart3, Wrench, Package, RefreshCw, TrendingUp, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { db, collections, getDocs, collection, query, orderBy, limit } from '@/lib/firebase/client';

interface DashboardStats {
  currentMonthCommissions: number;
  currentMonthRevenue: number;
  firebaseCustomers: number;
  supabaseAccounts: number;
  syncHealthy: boolean;
  lastImportDate: string | null;
  totalOrders: number;
  pendingIssues: number;
}

interface RecentActivity {
  type: string;
  description: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info';
}

export default function AdminPage() {
  const { user, userProfile, loading, isAdmin, isManager } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    currentMonthCommissions: 0,
    currentMonthRevenue: 0,
    firebaseCustomers: 0,
    supabaseAccounts: 0,
    syncHealthy: false,
    lastImportDate: null,
    totalOrders: 0,
    pendingIssues: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (user && (isAdmin || isManager)) {
      loadDashboardData();
    }
  }, [user, isAdmin, isManager]);

  const loadDashboardData = async () => {
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const monthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

      // 1. CURRENT MONTH COMMISSIONS
      let totalCommissions = 0;
      let totalRevenue = 0;
      try {
        const commissionsSnap = await getDocs(collection(db, 'monthly_commissions'));
        commissionsSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.month === monthKey || (data.year === currentYear && data.month === currentMonth)) {
            totalCommissions += data.totalCommission || 0;
            totalRevenue += data.revenue || 0;
          }
        });
      } catch (error) {
        console.error('Error loading commissions:', error);
      }

      // 2. FIREBASE CUSTOMERS COUNT
      let firebaseCount = 0;
      try {
        const customersSnap = await getDocs(collection(db, 'fishbowl_customers'));
        firebaseCount = customersSnap.size;
      } catch (error) {
        console.error('Error loading Firebase customers:', error);
      }

      // 3. SUPABASE SYNC STATUS
      let supabaseCount = 0;
      let syncHealthy = false;
      try {
        const syncResponse = await fetch('/api/sync-firebase-to-supabase?companyId=kanva-botanicals');
        const syncData = await syncResponse.json();
        if (syncData.success && syncData.status) {
          supabaseCount = syncData.status.supabaseAccounts;
          syncHealthy = !syncData.status.needsSync;
        }
      } catch (error) {
        console.error('Error checking sync status:', error);
      }

      // 4. TOTAL ORDERS (CURRENT MONTH)
      let ordersCount = 0;
      try {
        const ordersSnap = await getDocs(collection(db, 'fishbowl_sales_orders'));
        ordersSnap.docs.forEach(doc => {
          const data = doc.data();
          const orderDate = data.issuedDate?.toDate?.() || data.dateIssued?.toDate?.();
          if (orderDate && 
              orderDate.getFullYear() === currentYear && 
              orderDate.getMonth() === currentDate.getMonth()) {
            ordersCount++;
          }
        });
      } catch (error) {
        console.error('Error loading orders:', error);
      }

      // 5. LAST IMPORT DATE
      let lastImport = null;
      try {
        const importLogsQuery = query(
          collection(db, 'import_logs'),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const importSnap = await getDocs(importLogsQuery);
        if (!importSnap.empty) {
          lastImport = importSnap.docs[0].data().timestamp?.toDate?.().toLocaleDateString();
        }
      } catch (error) {
        console.error('Error loading import logs:', error);
      }

      // 6. RECENT ACTIVITY
      const activities: RecentActivity[] = [];
      
      // Sync status activity
      if (syncHealthy) {
        activities.push({
          type: 'Sync',
          description: `Firebase ↔ Supabase in sync (${supabaseCount} accounts)`,
          timestamp: 'Just checked',
          status: 'success'
        });
      } else if (firebaseCount > supabaseCount) {
        activities.push({
          type: 'Sync',
          description: `${firebaseCount - supabaseCount} customers need syncing to Supabase`,
          timestamp: 'Action required',
          status: 'warning'
        });
      }

      // Current month performance
      if (totalCommissions > 0) {
        activities.push({
          type: 'Commissions',
          description: `$${totalCommissions.toLocaleString()} earned this month`,
          timestamp: `${ordersCount} orders`,
          status: 'success'
        });
      }

      setStats({
        currentMonthCommissions: totalCommissions,
        currentMonthRevenue: totalRevenue,
        firebaseCustomers: firebaseCount,
        supabaseAccounts: supabaseCount,
        syncHealthy,
        lastImportDate: lastImport,
        totalOrders: ordersCount,
        pendingIssues: syncHealthy ? 0 : (firebaseCount - supabaseCount)
      });

      setRecentActivity(activities);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-kanva-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user || (!isAdmin && !isManager)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white shadow-sm rounded-xl p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600 mb-6">You need admin or manager privileges to access this page.</p>
          <Link href="/" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-kanva-green text-white hover:bg-green-600 transition-colors">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // Overview Dashboard Component
  const OverviewDashboard = () => (
    <div className="space-y-6">
      {/* Quick Stats - USEFUL METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* CURRENT MONTH COMMISSIONS */}
        <Link href="/settings?tab=commissions" className="bg-white rounded-lg p-4 border-2 border-green-200 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Month Commissions</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          {loadingStats ? (
            <div className="h-8 bg-gray-100 animate-pulse rounded"></div>
          ) : (
            <p className="text-2xl font-bold text-green-600">
              ${stats.currentMonthCommissions.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {stats.totalOrders} orders • {new Date().toLocaleDateString('en-US', { month: 'long' })}
          </p>
        </Link>
        
        {/* CURRENT MONTH REVENUE */}
        <Link href="/settings?tab=commissions" className="bg-white rounded-lg p-4 border-2 border-blue-200 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Month Revenue</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          {loadingStats ? (
            <div className="h-8 bg-gray-100 animate-pulse rounded"></div>
          ) : (
            <p className="text-2xl font-bold text-blue-600">
              ${stats.currentMonthRevenue.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {stats.currentMonthRevenue > 0 
              ? `${((stats.currentMonthCommissions / stats.currentMonthRevenue) * 100).toFixed(1)}% commission rate`
              : 'No revenue yet'}
          </p>
        </Link>
        
        {/* SYNC HEALTH STATUS */}
        <Link 
          href="/admin/tools/sync-firebase-supabase" 
          className={`bg-white rounded-lg p-4 border-2 hover:shadow-lg transition-shadow cursor-pointer ${
            stats.syncHealthy ? 'border-green-200' : 'border-yellow-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Sync Status</span>
            {stats.syncHealthy ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            )}
          </div>
          {loadingStats ? (
            <div className="h-8 bg-gray-100 animate-pulse rounded"></div>
          ) : (
            <p className={`text-2xl font-bold ${stats.syncHealthy ? 'text-green-600' : 'text-yellow-600'}`}>
              {stats.syncHealthy ? 'In Sync' : 'Needs Sync'}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {stats.firebaseCustomers} Firebase • {stats.supabaseAccounts} Supabase
          </p>
        </Link>
        
        {/* LAST IMPORT / DATA FRESHNESS */}
        <Link href="/admin/tools/fishbowl-import" className="bg-white rounded-lg p-4 border-2 border-purple-200 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Data Freshness</span>
            <Database className="w-5 h-5 text-purple-600" />
          </div>
          {loadingStats ? (
            <div className="h-8 bg-gray-100 animate-pulse rounded"></div>
          ) : (
            <p className="text-2xl font-bold text-purple-600">
              {stats.lastImportDate || 'Never'}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Last Fishbowl import • Click to import
          </p>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-kanva-green to-green-600 rounded-lg p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href="/admin/tools/fishbowl-import"
            className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <Database className="w-5 h-5" />
            <div>
              <div className="font-medium">Fishbowl Import</div>
              <div className="text-xs opacity-90">Upload Conversite CSV</div>
            </div>
          </Link>
          <Link
            href="/admin/tools/sync-firebase-supabase"
            className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            <div>
              <div className="font-medium">Run Sync</div>
              <div className="text-xs opacity-90">Firebase → Supabase</div>
            </div>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            <div>
              <div className="font-medium">Commissions</div>
              <div className="text-xs opacity-90">View & calculate</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <button
            onClick={loadDashboardData}
            className="text-sm text-kanva-green hover:text-green-600 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        {loadingStats ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded"></div>
            ))}
          </div>
        ) : recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-center gap-3 text-sm p-2 hover:bg-gray-50 rounded">
                {activity.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : activity.status === 'warning' ? (
                  <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0"></div>
                )}
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{activity.type}:</span>{' '}
                  <span className="text-gray-600">{activity.description}</span>
                </div>
                <span className="text-gray-400 text-xs">{activity.timestamp}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            System Settings
          </h3>
          <div className="space-y-3">
            <Link href="/admin/users" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">User Management</span>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
            <Link href="/admin/goals" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Team Goals</span>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
            <Link href="/settings" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Commission Settings</span>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plug className="w-5 h-5 text-gray-600" />
            Integrations
          </h3>
          <div className="space-y-3">
            <Link href="/admin/tools" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Wrench className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Import Tools</span>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
            <Link href="/admin/tools/sync-firebase-supabase" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border-l-2 border-purple-500">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Firebase → Supabase Sync</span>
              </div>
              <span className="text-xs text-purple-600">NEW</span>
            </Link>
            <Link href="/admin/justcall" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">JustCall</span>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700">Copper CRM</span>
              </div>
              <span className="text-xs text-green-600">Connected</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 mt-1">Portal-wide administration, integrations, and system settings</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-200">
              Commission Settings →
            </Link>
            <Link href="/" className="text-sm text-kanva-green hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <OverviewDashboard />
    </div>
  );
}
