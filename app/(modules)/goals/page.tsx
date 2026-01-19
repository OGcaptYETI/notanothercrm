'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { goalService, metricService, settingsService, userService } from '@/lib/firebase/services/goals';
import { Goal, GoalPeriod, GoalType, Metric, User as GoalsUser } from '@/types/goals';
import { eachDayOfInterval, endOfMonth, format, startOfMonth, subDays } from 'date-fns';
import GoalGrid from '@/components/goals-tracker/organisms/GoalGrid';
import GoalSetter from '@/components/goals-tracker/molecules/GoalSetter';
import toast from 'react-hot-toast';
import Link from 'next/link';

const goalTypes: GoalType[] = [
  'phone_call_quantity',
  'email_quantity',
  'sms_quantity',
  'lead_progression_a',
  'lead_progression_b',
  'lead_progression_c',
  'new_sales_wholesale',
  'new_sales_distribution'
];

export default function GoalsPage() {
  const { user, userProfile, isAdmin } = useAuth();
  const [period, setPeriod] = useState<GoalPeriod>('weekly');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [teamGoals, setTeamGoals] = useState<Record<string, any> | null>(null);
  const [teamTotals, setTeamTotals] = useState<Record<string, number>>({});
  const [showSetter, setShowSetter] = useState(false);
  const [setterType, setSetterType] = useState<GoalType | null>(null);
  const [calendarMarks, setCalendarMarks] = useState<Record<string, boolean>>({});
  const [calendarColors, setCalendarColors] = useState<Record<string, { pct: number; color: string }>>({});
  
  // Admin features: view all users
  const [allUsers, setAllUsers] = useState<GoalsUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const viewingUserId = selectedUserId || user?.uid || '';

  // Load all users for admin
  useEffect(() => {
    if (!isAdmin) return;
    
    const loadUsers = async () => {
      const users = await userService.getAllUsers();
      setAllUsers(users);
    };
    
    loadUsers();
  }, [isAdmin]);

  // Load user goals and metrics
  useEffect(() => {
    if (!user || !viewingUserId) return;

    const loadData = async () => {
      try {
        const g = await goalService.getUserGoals(viewingUserId, period);
        setGoals(g);
        
        const today = new Date();
        const start = subDays(today, 29);
        const perDay: Record<string, boolean> = {};
        const colorData: Record<string, { pct: number; color: string }> = {};
        
        for (const t of goalTypes) {
          const ms = await metricService.getMetrics(viewingUserId, t, start, today);
          ms.forEach(m => { 
            const k = format(m.date, 'yyyy-MM-dd'); 
            perDay[k] = true;
            
            const goal = g.find(goal => goal.type === t && goal.period === 'weekly');
            if (goal && goal.target > 0) {
              const completion = Math.min((m.value / goal.target) * 100, 100);
              if (!colorData[k]) {
                colorData[k] = { pct: 0, color: 'bg-gray-50' };
              }
              const currentPct = colorData[k].pct;
              const newPct = currentPct > 0 ? (currentPct + completion) / 2 : completion;
              colorData[k].pct = newPct;
              
              if (newPct < 34) {
                colorData[k].color = 'bg-red-50 border-red-200';
              } else if (newPct < 67) {
                colorData[k].color = 'bg-yellow-50 border-yellow-200';
              } else {
                colorData[k].color = 'bg-green-50 border-green-200';
              }
            }
          });
        }
        
        setCalendarMarks(perDay);
        setCalendarColors(colorData);
        
        // Subscribe to real-time metrics
        const unsubscribe = metricService.subscribeToMetrics(viewingUserId, setMetrics);
        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading goals data:', error);
        toast.error('Failed to load goals data');
      }
    };

    loadData();
  }, [user, period, viewingUserId]);

  // Load team aggregates
  useEffect(() => {
    const loadTeamData = async () => {
      try {
        const teamGoalsData = await settingsService.getTeamGoals();
        setTeamGoals(teamGoalsData);
        
        // Calculate team totals from all users' metrics
        const totals: Record<string, number> = {};
        for (const type of goalTypes) {
          const teamMetrics = await metricService.getTeamMetrics(type, period);
          let total = 0;
          teamMetrics.forEach(value => total += value);
          totals[type] = total;
        }
        setTeamTotals(totals);
      } catch (error) {
        console.error('Error loading team data:', error);
      }
    };

    loadTeamData();
  }, [period]);

  const calendarDays = useMemo(() => {
    const now = new Date();
    const days = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
    return days.map((d) => ({
      date: d,
      key: format(d, 'yyyy-MM-dd'),
    }));
  }, []);

  const handleEditGoal = (type: GoalType) => {
    setSetterType(type);
    setShowSetter(true);
  };

  const syncJustCall = async () => {
    if (!user) return;
    try {
      toast.loading('Syncing JustCall metrics...');
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      
      const idToken = await user.getIdToken();
      const res = await fetch('/api/goals/sync-justcall', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'JustCall sync failed');
      toast.dismiss();
      toast.success(`JustCall synced: ${data.totalCalls} calls, ${data.totalSMS} SMS`);
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message || 'JustCall sync error');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Please log in</h2>
          <p className="text-gray-600">You need to be logged in to view your goals.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* 1. User Header - NO LOGIN BAR */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-kanva-green text-white grid place-items-center">🌿</div>
            <div>
              <div className="text-sm text-gray-500">Kanva Botanicals</div>
              <div className="font-semibold">
                {isAdmin && selectedUserId 
                  ? allUsers.find(u => u.id === selectedUserId)?.name || 'User'
                  : userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Sales Rep'}
              </div>
              <div className="text-xs text-gray-500">
                {isAdmin && selectedUserId 
                  ? allUsers.find(u => u.id === selectedUserId)?.email || ''
                  : user?.email || ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Admin User Selector */}
            {isAdmin && allUsers.length > 0 && (
              <select
                value={selectedUserId || user?.uid || ''}
                onChange={(e) => setSelectedUserId(e.target.value === user?.uid ? null : e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-kanva-green focus:border-transparent"
              >
                <option value={user?.uid || ''}>My Goals</option>
                <optgroup label="Team Members">
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
            
            {/* Period Selector */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {(['weekly','monthly','quarterly'] as GoalPeriod[]).map((p) => (
                <button 
                  key={p} 
                  onClick={() => setPeriod(p)} 
                  className={`px-3 py-1 rounded-md text-sm ${period===p?'bg-white text-kanva-green shadow-sm':'text-gray-600'}`}
                >
                  {p[0].toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={()=>{ setSetterType('email_quantity'); setShowSetter(true); }} 
            className="px-4 py-2 rounded-lg bg-kanva-green text-white hover:bg-green-600"
          >
            Set New Goal
          </button>
          <button 
            onClick={syncJustCall} 
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Sync JustCall (30d)
          </button>
        </div>
      </div>

      {/* 3. My Active Goals */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">My Active Goals</h3>
          <span className="text-sm text-gray-500">{period.charAt(0).toUpperCase() + period.slice(1)} Period</span>
        </div>
        <GoalGrid
          goalTypes={goalTypes}
          goals={goals}
          selectedPeriod={period}
          onAddGoal={handleEditGoal}
          onEditGoal={handleEditGoal}
        />
      </div>

      {/* 4. Weekly Overview */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-lg font-semibold mb-3">My Weekly Activity</h3>
        <div className="grid grid-cols-7 gap-3">
          {eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }).map((d) => {
            const dayKey = format(d, 'yyyy-MM-dd');
            const dailyEmails = metrics.filter(m=>m.type==='email_quantity' && format(m.date,'yyyy-MM-dd')===dayKey).reduce((a,b)=>a+b.value,0);
            const dailyCalls = metrics.filter(m=>m.type==='phone_call_quantity' && format(m.date,'yyyy-MM-dd')===dayKey).reduce((a,b)=>a+b.value,0);
            const dailyLeads = metrics.filter(m=>m.type==='lead_progression_a' || m.type==='lead_progression_b' || m.type==='lead_progression_c').filter(m=>format(m.date,'yyyy-MM-dd')===dayKey).reduce((a,b)=>a+b.value,0);
            const maxBar = Math.max(1, dailyEmails, dailyCalls, dailyLeads);
            const isToday = format(d,'yyyy-MM-dd')===format(new Date(),'yyyy-MM-dd');
            return (
              <div key={dayKey} className={`p-3 rounded-lg border ${isToday?'border-kanva-green bg-green-50':''}`}>
                <div className="text-xs font-medium text-gray-700 mb-1">{format(d, 'EEE')}</div>
                <div className="text-xs text-gray-500 mb-2">{format(d, 'M/d')}</div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-gray-100 rounded"><div className="h-1.5 bg-kanva-green rounded" style={{width:`${Math.round(dailyEmails/maxBar*100)}%`}}/></div>
                  <div className="h-1.5 bg-gray-100 rounded"><div className="h-1.5 bg-blue-500 rounded" style={{width:`${Math.round(dailyCalls/maxBar*100)}%`}}/></div>
                  <div className="h-1.5 bg-gray-100 rounded"><div className="h-1.5 bg-amber-500 rounded" style={{width:`${Math.round(dailyLeads/maxBar*100)}%`}}/></div>
                </div>
                <div className="mt-1 text-[10px] text-gray-500">E:{dailyEmails} • C:{dailyCalls} • L:{dailyLeads}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-gray-500">📊 Emails (green) • Calls (blue) • Leads (amber)</div>
      </div>

      {/* 5. Team Overview */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Team Performance</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goalTypes.map((t) => {
            const value = Number(teamTotals[t] || 0);
            const target = Number(teamGoals?.[period]?.[t] ?? 0);
            const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
            const label = t === 'phone_call_quantity' ? 'Phone Calls' : t.replace(/_/g, ' ').replace(/\b\w/g, (l)=>l.toUpperCase());
            const isMoney = t.startsWith('new_sales_');
            return (
              <div key={t} className="rounded-lg border border-gray-100 p-4">
                <div className="text-sm text-gray-500">{label} ({period})</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {isMoney ? `$${value.toLocaleString()}` : value}
                  <span className="text-sm text-gray-500 ml-2">of {isMoney ? `$${target.toLocaleString()}` : target}</span>
                </div>
                <div className="mt-3 h-2 bg-gray-100 rounded">
                  <div className="h-2 bg-kanva-green rounded" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Goals Calendar */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Goals Calendar</h3>
          <div className="text-sm text-gray-500">{format(new Date(), 'MMMM yyyy')}</div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map(({ date, key }) => {
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const hit = !!calendarMarks[key];
            const colorInfo = calendarColors[key];
            const bgColor = colorInfo?.color || 'bg-white';
            const borderColor = isToday ? 'border-2 border-kanva-green' : 'border border-gray-200';
            
            return (
              <div 
                key={key} 
                className={`h-16 rounded-lg flex flex-col items-center justify-center text-sm relative ${bgColor} ${borderColor} transition-colors`}
                title={colorInfo ? `${Math.round(colorInfo.pct)}% goals completed` : 'No goals tracked'}
              >
                <div className="text-gray-800 font-medium">{format(date, 'd')}</div>
                {hit && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-gray-600" />}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-50 border border-green-200"></div>
            <span>67-100% goals met</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-50 border border-yellow-200"></div>
            <span>34-66% goals met</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-50 border border-red-200"></div>
            <span>0-33% goals met</span>
          </div>
        </div>
      </div>

      {/* NO SHARPENING THE SAW SECTION */}

      {showSetter && setterType && viewingUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full">
            <GoalSetter
              userId={viewingUserId}
              goalType={setterType}
              period={period}
              existingGoal={goals.find(g=>g.type===setterType) || undefined}
              onSave={(goal)=>{ setGoals(prev=>[...prev.filter(g=>g.id!==goal.id), goal]); setShowSetter(false); setSetterType(null); }}
              onCancel={()=>{ setShowSetter(false); setSetterType(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
