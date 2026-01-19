'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  DollarSign,
  Award,
  Target,
  FileText,
  TrendingUp,
  Database,
  Settings
} from 'lucide-react';
import { TopProductsWidget } from '@/components/TopProductsWidget';
import RegionMap from '@/app/settings/RegionMap';

interface DashboardStats {
  totalPayout: number;
  avgAttainment: number;
  budget: number;
  utilization: number;
}

interface MonthlyStats {
  currentMonth: string;
  monthlyCommission: number;
  monthlySpiffs: number;
  monthlyOrders: number;
  ytdCommission: number;
  last3Months: Array<{
    month: string;
    commission: number;
    spiffs: number;
  }>;
}

export default function CommissionsPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, canViewAllCommissions } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalPayout: 0,
    avgAttainment: 0,
    budget: 25000,
    utilization: 0,
  });
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    currentMonth: '',
    monthlyCommission: 0,
    monthlySpiffs: 0,
    monthlyOrders: 0,
    ytdCommission: 0,
    last3Months: [],
  });
  const [salesPersonId, setSalesPersonId] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      let userSalesPerson = userProfile?.salesPerson || '';
      
      if (!userSalesPerson && !canViewAllCommissions) {
        const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          userSalesPerson = userData.salesPerson || '';
        }
      }
      
      setSalesPersonId(userSalesPerson);
      
      if (canViewAllCommissions) {
        await loadTeamDashboardStats();
        await loadTeamMonthlyStats();
      } else {
        await loadDashboardStats(user.uid);
        await loadMonthlyStats(userSalesPerson);
      }
      
      setLoading(false);
    };

    loadData();
  }, [authLoading, user, router]);

  const loadDashboardStats = async (userId: string) => {
    try {
      const entriesRef = collection(db, 'commission_entries');
      const q = query(
        entriesRef,
        where('repId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      let totalPayout = 0;
      let totalAttainment = 0;
      let count = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.payout) totalPayout += data.payout;
        if (data.attainment) {
          totalAttainment += data.attainment;
          count++;
        }
      });
      
      const avgAttainment = count > 0 ? totalAttainment / count : 0;
      const budget = 25000;
      const utilization = budget > 0 ? totalPayout / budget : 0;
      
      setStats({
        totalPayout,
        avgAttainment,
        budget,
        utilization,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const loadMonthlyStats = async (salesPersonId: string) => {
    if (!salesPersonId) return;
    
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentMonthKey = `${currentYear}-${currentMonth}`;
      
      const summariesQuery = query(
        collection(db, 'monthly_commission_summary'),
        where('salesPerson', '==', salesPersonId),
        orderBy('month', 'desc')
      );
      
      const summariesSnapshot = await getDocs(summariesQuery);
      const summaries: any[] = [];
      summariesSnapshot.forEach((doc) => {
        summaries.push({ id: doc.id, ...doc.data() });
      });
      
      const currentMonthData = summaries.find(s => s.month === currentMonthKey);
      const monthlyCommission = currentMonthData?.totalCommission || 0;
      const monthlySpiffs = currentMonthData?.totalSpiffs || 0;
      const monthlyOrders = currentMonthData?.totalOrders || 0;
      
      const ytdCommission = summaries
        .filter(s => s.year === currentYear)
        .reduce((sum, s) => sum + (s.totalCommission || 0), 0);
      
      const last3Months = summaries.slice(0, 3).map(s => ({
        month: s.month,
        commission: s.totalCommission || 0,
        spiffs: s.totalSpiffs || 0,
      }));
      
      setMonthlyStats({
        currentMonth: currentMonthKey,
        monthlyCommission,
        monthlySpiffs,
        monthlyOrders,
        ytdCommission,
        last3Months,
      });
    } catch (error) {
      console.error('Error loading monthly stats:', error);
    }
  };

  const loadTeamDashboardStats = async () => {
    try {
      const entriesRef = collection(db, 'commission_entries');
      const q = query(entriesRef, orderBy('createdAt', 'desc'));
      
      const snapshot = await getDocs(q);
      
      let totalPayout = 0;
      let totalAttainment = 0;
      let count = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.payout) totalPayout += data.payout;
        if (data.attainment) {
          totalAttainment += data.attainment;
          count++;
        }
      });
      
      const avgAttainment = count > 0 ? totalAttainment / count : 0;
      
      const uniqueReps = new Set<string>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.repId) uniqueReps.add(data.repId);
      });
      const budget = uniqueReps.size * 25000;
      const utilization = budget > 0 ? totalPayout / budget : 0;
      
      setStats({
        totalPayout,
        avgAttainment,
        budget,
        utilization,
      });
    } catch (error) {
      console.error('Error loading team dashboard stats:', error);
    }
  };

  const loadTeamMonthlyStats = async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentMonthKey = `${currentYear}-${currentMonth}`;
      
      const summariesQuery = query(
        collection(db, 'monthly_commission_summary'),
        orderBy('month', 'desc')
      );
      
      const summariesSnapshot = await getDocs(summariesQuery);
      const summaries: any[] = [];
      summariesSnapshot.forEach((doc) => {
        summaries.push({ id: doc.id, ...doc.data() });
      });
      
      const currentMonthSummaries = summaries.filter(s => s.month === currentMonthKey);
      const monthlyCommission = currentMonthSummaries.reduce((sum, s) => sum + (s.totalCommission || 0), 0);
      const monthlySpiffs = currentMonthSummaries.reduce((sum, s) => sum + (s.totalSpiffs || 0), 0);
      const monthlyOrders = currentMonthSummaries.reduce((sum, s) => sum + (s.totalOrders || 0), 0);
      
      const ytdCommission = summaries
        .filter(s => s.year === currentYear)
        .reduce((sum, s) => sum + (s.totalCommission || 0), 0);
      
      const monthKeys = [...new Set(summaries.map(s => s.month))].slice(0, 3);
      const last3Months = monthKeys.map(monthKey => {
        const monthSummaries = summaries.filter(s => s.month === monthKey);
        return {
          month: monthKey,
          commission: monthSummaries.reduce((sum, s) => sum + (s.totalCommission || 0), 0),
          spiffs: monthSummaries.reduce((sum, s) => sum + (s.totalSpiffs || 0), 0),
        };
      });
      
      setMonthlyStats({
        currentMonth: currentMonthKey,
        monthlyCommission,
        monthlySpiffs,
        monthlyOrders,
        ytdCommission,
        last3Months,
      });
    } catch (error) {
      console.error('Error loading team monthly stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-[#93D500] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {canViewAllCommissions ? 'Team Commissions' : 'My Commissions'}
        </h1>
        <p className="text-gray-500 mt-1">Track monthly commissions and quarterly bonuses</p>
      </div>

      {/* Quick Actions - Moved Higher */}
      <div className="grid md:grid-cols-2 gap-4">
        <button
          onClick={() => router.push('/reports')}
          className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center mb-3">
            <FileText className="w-6 h-6 text-[#93D500] mr-3" />
            <h3 className="font-semibold text-gray-900">Review Commissions</h3>
          </div>
          <p className="text-sm text-gray-600">
            View detailed commission reports and quarterly bonuses
          </p>
        </button>

        {canViewAllCommissions && (
          <button
            onClick={() => router.push('/team')}
            className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center mb-3">
              <TrendingUp className="w-6 h-6 text-[#93D500] mr-3" />
              <h3 className="font-semibold text-gray-900">Team View</h3>
            </div>
            <p className="text-sm text-gray-600">
              View all reps performance and rankings
            </p>
          </button>
        )}
      </div>

      {/* Monthly Commission Stats */}
      {(salesPersonId || canViewAllCommissions) && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Commissions</h2>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">This Month</h3>
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ${monthlyStats.monthlyCommission.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {monthlyStats.currentMonth}
                  {canViewAllCommissions && ' (All Reps)'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Spiffs</h3>
                  <Award className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ${monthlyStats.monthlySpiffs.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  This month{canViewAllCommissions && ' (Team Total)'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Orders</h3>
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {monthlyStats.monthlyOrders}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  This month{canViewAllCommissions && ' (All Reps)'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">YTD Total</h3>
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ${monthlyStats.ytdCommission.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Year to date{canViewAllCommissions && ' (Team)'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quarterly Bonus Stats - HIDDEN (Feature not in use yet) */}
      {false && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quarterly Bonus</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Payout</h3>
                <DollarSign className="w-5 h-5 text-[#93D500]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ${stats.totalPayout.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Current quarter{canViewAllCommissions && ' (Team Total)'}
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Avg Attainment</h3>
                <Target className="w-5 h-5 text-[#93D500]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {(stats.avgAttainment * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Across all buckets{canViewAllCommissions && ' (Team Avg)'}
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Budget</h3>
                <Award className="w-5 h-5 text-[#93D500]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ${stats.budget.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {canViewAllCommissions ? 'Total team budget' : 'Max bonus per rep'}
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Utilization</h3>
                <TrendingUp className="w-5 h-5 text-[#93D500]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {(stats.utilization * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Of total budget{canViewAllCommissions && ' (Team)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Products Widget */}
      {canViewAllCommissions && (
        <TopProductsWidget 
          year={new Date().getFullYear()}
          limit={10}
          sortBy="commission"
        />
      )}

      {/* Regional Performance Dashboard */}
      {canViewAllCommissions && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Regional Performance</h2>
          <RegionMap />
        </div>
      )}

      {/* Commission Structure Info - REMOVED (Part of unused quarterly bonus feature) */}
    </div>
  );
}
