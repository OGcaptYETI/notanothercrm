'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Phone, MessageSquare, TrendingUp, Calendar, Users, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns';

interface CallMetrics {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  completedCalls: number;
  missedCalls: number;
  totalDuration: number;
  averageDuration: number;
  callsByDay: Record<string, number>;
}

interface TeamMemberMetrics {
  userId: string;
  name: string;
  email: string;
  calls: number;
  inbound: number;
  outbound: number;
  completed: number;
  missed: number;
  talkTime: number;
  avgDuration: number;
  connectionRate: number;
  trend: 'up' | 'down' | 'stable';
  previousPeriodCalls: number;
  change: number;
  changePercent: number;
  callsByDay?: Record<string, number>;
}

interface TeamTotals {
  totalCalls: number;
  totalInbound: number;
  totalOutbound: number;
  totalCompleted: number;
  totalMissed: number;
  totalTalkTime: number;
  avgConnectionRate: number;
  memberCount: number;
}

export default function CommsHistoryPage() {
  const { user, userProfile, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [myMetrics, setMyMetrics] = useState<CallMetrics | null>(null);
  const [teamMetrics, setTeamMetrics] = useState<TeamMemberMetrics[]>([]);
  const [teamTotals, setTeamTotals] = useState<TeamTotals | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Update date range when period changes
  useEffect(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (selectedPeriod) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'quarter':
        start = new Date(now);
        start.setMonth(now.getMonth() - 3);
        break;
    }

    setDateRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    });
  }, [selectedPeriod]);

  useEffect(() => {
    if (user?.email) {
      loadMetrics();
    }
  }, [user, dateRange]);

  // Auto-refresh every hour between 8AM-8PM
  useEffect(() => {
    if (!autoRefresh || !user?.email) return;
    
    const checkAndRefresh = () => {
      const hour = new Date().getHours();
      // Only refresh between 8AM (8) and 8PM (20)
      if (hour >= 8 && hour < 20) {
        loadMetrics();
      }
    };

    // Check immediately
    checkAndRefresh();
    
    // Then check every hour
    const interval = setInterval(checkAndRefresh, 3600000); // 1 hour

    return () => clearInterval(interval);
  }, [autoRefresh, user, dateRange]);

  // Load metrics from cache only - fast and instant
  const loadMetrics = async () => {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      
      // Fetch my metrics from cache
      const myResponse = await fetch(
        `/api/justcall/metrics?email=${user?.email}&start_date=${dateRange.start}&end_date=${dateRange.end}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (myResponse.ok) {
        const myData = await myResponse.json();
        setMyMetrics(myData.metrics);
      }

      // Fetch team metrics if admin (from cache)
      if (isAdmin) {
        const teamResponse = await fetch(
          `/api/justcall/team-metrics?start_date=${dateRange.start}&end_date=${dateRange.end}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (teamResponse.ok) {
          const teamData = await teamResponse.json();
          setTeamMetrics(teamData.teamMetrics || []);
          setTeamTotals(teamData.teamTotals || null);
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual sync function - only for admins, runs in background
  const syncMetrics = async () => {
    if (!isAdmin || syncing) return;
    
    setSyncing(true);
    try {
      const token = await user?.getIdToken();
      console.log('[Comms History] Starting manual sync...');
      
      const teamSyncResponse = await fetch('/api/justcall/sync-team-metrics', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (teamSyncResponse.ok) {
        const syncData = await teamSyncResponse.json();
        console.log(`[Comms History] Synced ${syncData.syncedUsers} users`);
        // Reload metrics from cache after sync
        await loadMetrics();
      } else {
        console.error('Failed to sync team metrics');
      }
    } catch (error) {
      console.error('Error syncing metrics:', error);
    } finally {
      setSyncing(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getSparklineData = (callsByDay: Record<string, number>) => {
    const days = eachDayOfInterval({
      start: new Date(dateRange.start),
      end: new Date(dateRange.end),
    });
    return days.map(day => callsByDay[format(day, 'yyyy-MM-dd')] || 0);
  };

  const renderSparkline = (data: number[]) => {
    const max = Math.max(...data, 1);
    const width = 100;
    const height = 30;
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="inline-block">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-kanva-green"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-kanva-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading communications data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Phone className="w-7 h-7 text-kanva-green" />
              Communications History
            </h1>
            <p className="text-sm text-gray-500 mt-1">Track your calls, texts, and team performance</p>
          </div>
          
          {/* Period Selector and Sync Button */}
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={syncMetrics}
                disabled={syncing}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  syncing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-kanva-green text-white hover:bg-kanva-green/90'
                }`}
              >
                <svg 
                  className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                {syncing ? 'Syncing...' : 'Sync Data'}
              </button>
            )}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['week', 'month', 'quarter'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                    selectedPeriod === period
                      ? 'bg-white text-kanva-green shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* My Metrics */}
      {myMetrics && (
        <>
          {/* Section Header */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border-l-4 border-blue-500">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Phone className="w-5 h-5 text-white" />
              </div>
              My Performance
            </h2>
            <p className="text-sm text-gray-600 mt-1 ml-11">Your personal call metrics for this {selectedPeriod}</p>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Calls */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Phone className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Calls</p>
                  <p className="text-3xl font-bold text-gray-900">{myMetrics.totalCalls}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">This {selectedPeriod}</span>
                {renderSparkline(getSparklineData(myMetrics.callsByDay))}
              </div>
            </div>

            {/* Inbound */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <Phone className="w-6 h-6 text-green-600 rotate-180" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Inbound</p>
                  <p className="text-3xl font-bold text-gray-900">{myMetrics.inboundCalls}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {myMetrics.totalCalls > 0 
                  ? `${Math.round((myMetrics.inboundCalls / myMetrics.totalCalls) * 100)}% of total`
                  : 'No calls yet'}
              </div>
            </div>

            {/* Outbound */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Phone className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Outbound</p>
                  <p className="text-3xl font-bold text-gray-900">{myMetrics.outboundCalls}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {myMetrics.totalCalls > 0
                  ? `${Math.round((myMetrics.outboundCalls / myMetrics.totalCalls) * 100)}% of total`
                  : 'No calls yet'}
              </div>
            </div>

            {/* Talk Time */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-50 rounded-lg">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Talk Time</p>
                  <p className="text-3xl font-bold text-gray-900">{formatDuration(myMetrics.totalDuration)}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Avg: {formatDuration(myMetrics.averageDuration)} per call
              </div>
            </div>
          </div>

          {/* Call Performance */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-kanva-green" />
              My Call Performance
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Completed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Completed</span>
                  <span className="text-2xl font-bold text-green-600">{myMetrics.completedCalls}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${myMetrics.totalCalls > 0 ? (myMetrics.completedCalls / myMetrics.totalCalls) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {myMetrics.totalCalls > 0
                    ? `${Math.round((myMetrics.completedCalls / myMetrics.totalCalls) * 100)}% success rate`
                    : 'N/A'}
                </p>
              </div>

              {/* Missed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Missed</span>
                  <span className="text-2xl font-bold text-red-600">{myMetrics.missedCalls}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full"
                    style={{
                      width: `${myMetrics.totalCalls > 0 ? (myMetrics.missedCalls / myMetrics.totalCalls) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {myMetrics.totalCalls > 0
                    ? `${Math.round((myMetrics.missedCalls / myMetrics.totalCalls) * 100)}% missed`
                    : 'N/A'}
                </p>
              </div>

              {/* Connection Rate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Connection Rate</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {myMetrics.totalCalls > 0
                      ? `${Math.round((myMetrics.completedCalls / myMetrics.totalCalls) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${myMetrics.totalCalls > 0 ? (myMetrics.completedCalls / myMetrics.totalCalls) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Industry avg: 65%
                </p>
              </div>
            </div>
          </div>

          {/* Daily Activity Chart - Team View for Admins */}
          {isAdmin && teamMetrics.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-kanva-green" />
                Team Daily Activity
              </h2>
              
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-4">
                {teamMetrics.slice(0, 7).map((member, idx) => {
                  const colors = [
                    'bg-blue-500',
                    'bg-green-500', 
                    'bg-purple-500',
                    'bg-orange-500',
                    'bg-pink-500',
                    'bg-indigo-500',
                    'bg-yellow-500'
                  ];
                  return (
                    <div key={member.userId} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors[idx]}`}></div>
                      <span className="text-xs text-gray-600">{member.name}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="space-y-2">
                {eachDayOfInterval({
                  start: new Date(dateRange.start),
                  end: new Date(dateRange.end)
                })
                  .reverse()
                  .slice(0, 14)
                  .map((date) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const colors = [
                      'bg-blue-500',
                      'bg-green-500',
                      'bg-purple-500',
                      'bg-orange-500',
                      'bg-pink-500',
                      'bg-indigo-500',
                      'bg-yellow-500'
                    ];
                    
                    // Get calls for each team member on this date
                    const memberCalls = teamMetrics.slice(0, 7).map((member, idx) => ({
                      name: member.name,
                      calls: member.callsByDay?.[dateStr] || 0,
                      color: colors[idx]
                    }));
                    
                    const totalCalls = memberCalls.reduce((sum, m) => sum + m.calls, 0);
                    const maxDailyCalls = Math.max(...eachDayOfInterval({
                      start: new Date(dateRange.start),
                      end: new Date(dateRange.end)
                    }).map(d => {
                      const dStr = format(d, 'yyyy-MM-dd');
                      return teamMetrics.reduce((sum, m) => sum + (m.callsByDay?.[dStr] || 0), 0);
                    }));
                    
                    return (
                      <div key={dateStr} className="flex items-center gap-4">
                        <span className="text-sm text-gray-600 w-24">{format(date, 'MMM dd')}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                          <div className="flex h-8" style={{ width: `${maxDailyCalls > 0 ? (totalCalls / maxDailyCalls) * 100 : 0}%` }}>
                            {memberCalls.map((member, idx) => {
                              const width = totalCalls > 0 ? (member.calls / totalCalls) * 100 : 0;
                              return member.calls > 0 ? (
                                <div
                                  key={idx}
                                  className={`${member.color} h-8 flex items-center justify-center`}
                                  style={{ width: `${width}%` }}
                                  title={`${member.name}: ${member.calls} calls`}
                                >
                                  {width > 15 && (
                                    <span className="text-xs font-medium text-white">{member.calls}</span>
                                  )}
                                </div>
                              ) : null;
                            })}
                          </div>
                          {totalCalls > 0 && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-700">
                              {totalCalls}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* Personal Daily Activity for non-admins */
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-kanva-green" />
                Daily Activity
              </h2>
              
              <div className="space-y-2">
                {Object.entries(myMetrics.callsByDay)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 14)
                  .map(([date, count]) => (
                    <div key={date} className="flex items-center gap-4">
                      <span className="text-sm text-gray-600 w-24">{format(new Date(date), 'MMM dd')}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                        <div
                          className="bg-kanva-green h-8 rounded-full flex items-center justify-end pr-3"
                          style={{
                            width: `${Math.min((count / Math.max(...Object.values(myMetrics.callsByDay))) * 100, 100)}%`,
                          }}
                        >
                          <span className="text-sm font-medium text-white">{count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Team Performance (Admin Only) */}
      {isAdmin && teamTotals && (
        <>
          {/* Team Totals */}
          <div className="bg-gradient-to-br from-kanva-green to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="w-7 h-7" />
                  Team Performance
                </h2>
                <p className="text-green-100 text-sm mt-1">
                  {teamTotals.memberCount} active team members • {format(new Date(dateRange.start), 'MMM d')} - {format(new Date(dateRange.end), 'MMM d, yyyy')}
                </p>
              </div>
              {lastUpdated && (
                <div className="text-right">
                  <p className="text-xs text-green-100">Last updated</p>
                  <p className="text-sm font-medium">{format(lastUpdated, 'h:mm a')}</p>
                  <button
                    onClick={() => loadMetrics()}
                    className="text-xs text-green-100 hover:text-white underline mt-1"
                  >
                    Refresh now
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-green-100 text-sm mb-1">Total Calls</p>
                <p className="text-3xl font-bold">{teamTotals.totalCalls}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-green-100 text-sm mb-1">Completed</p>
                <p className="text-3xl font-bold">{teamTotals.totalCompleted}</p>
                <p className="text-xs text-green-100 mt-1">
                  {teamTotals.totalCalls > 0 
                    ? `${Math.round((teamTotals.totalCompleted / teamTotals.totalCalls) * 100)}%`
                    : '0%'}
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-green-100 text-sm mb-1">Talk Time</p>
                <p className="text-3xl font-bold">{formatDuration(teamTotals.totalTalkTime)}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-green-100 text-sm mb-1">Avg Connection</p>
                <p className="text-3xl font-bold">{teamTotals.avgConnectionRate}%</p>
              </div>
            </div>
          </div>

          {/* Team Leaderboard */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Leaderboard</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Team Member</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Calls</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Completed</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Connection</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Talk Time</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMetrics.map((member, index) => (
                    <tr 
                      key={member.userId} 
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        member.userId === user?.uid ? 'bg-green-50' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {index === 0 && <span className="text-2xl">🥇</span>}
                          {index === 1 && <span className="text-2xl">🥈</span>}
                          {index === 2 && <span className="text-2xl">🥉</span>}
                          {index > 2 && <span className="text-gray-500 font-medium">#{index + 1}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {member.name}
                            {member.userId === user?.uid && (
                              <span className="ml-2 text-xs bg-kanva-green text-white px-2 py-0.5 rounded">You</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{member.email}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-semibold text-gray-900">{member.calls}</div>
                        {member.change !== 0 && (
                          <div className={`text-xs ${member.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {member.change > 0 ? '+' : ''}{member.change} ({member.changePercent}%)
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-semibold text-gray-900">{member.completed}</div>
                        <div className="text-xs text-gray-500">
                          {member.missed} missed
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className={`font-semibold ${
                          member.connectionRate >= 70 ? 'text-green-600' :
                          member.connectionRate >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {member.connectionRate}%
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-semibold text-gray-900">{formatDuration(member.talkTime)}</div>
                        <div className="text-xs text-gray-500">
                          {formatDuration(member.avgDuration)} avg
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {member.trend === 'up' && <TrendingUp className="w-5 h-5 text-green-600 ml-auto" />}
                        {member.trend === 'down' && <TrendingUp className="w-5 h-5 text-red-600 ml-auto rotate-180" />}
                        {member.trend === 'stable' && <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
