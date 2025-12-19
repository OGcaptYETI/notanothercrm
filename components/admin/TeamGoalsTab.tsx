'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChange } from '@/lib/firebase/client';
import toast from 'react-hot-toast';
import { Target, Phone, Mail, MessageSquare, Users, DollarSign, TrendingUp, Calendar } from 'lucide-react';

export default function TeamGoalsTab() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [teamGoals, setTeamGoals] = useState<Record<string, any>>({
    daily: {
      phone_call_quantity: 125,
      email_quantity: 50,
      sms_quantity: 50,
      lead_progression_a: 15,
      lead_progression_b: 10,
      lead_progression_c: 5,
      new_sales_wholesale: 5000,
      new_sales_distribution: 10000,
    },
    weekly: {
      phone_call_quantity: 625,
      email_quantity: 250,
      sms_quantity: 250,
      lead_progression_a: 75,
      lead_progression_b: 50,
      lead_progression_c: 25,
      new_sales_wholesale: 25000,
      new_sales_distribution: 50000,
    },
    monthly: {
      phone_call_quantity: 2500,
      email_quantity: 1000,
      sms_quantity: 1000,
      lead_progression_a: 300,
      lead_progression_b: 200,
      lead_progression_c: 100,
      new_sales_wholesale: 100000,
      new_sales_distribution: 200000,
    },
    quarterly: {
      phone_call_quantity: 7500,
      email_quantity: 3000,
      sms_quantity: 3000,
      lead_progression_a: 900,
      lead_progression_b: 600,
      lead_progression_c: 300,
      new_sales_wholesale: 300000,
      new_sales_distribution: 600000,
    },
  });

  useEffect(() => {
    const unsub = onAuthStateChange((u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  const saveTeamGoals = async () => {
    if (!uid) return;
    if (!pwdInput) {
      toast.error('Password required');
      return;
    }
    setShowPwd(false);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/team-goals', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-pass': pwdInput
        },
        body: JSON.stringify({ teamGoals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save team goals');
      toast.success('Team goals saved successfully! 🎯');
      setPwdInput('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save team goals');
    } finally {
      setLoading(false);
    }
  };

  const periodIcons: Record<string, any> = {
    daily: <Calendar className="w-5 h-5" />,
    weekly: <TrendingUp className="w-5 h-5" />,
    monthly: <Target className="w-5 h-5" />,
    quarterly: <Target className="w-5 h-5" />
  };

  const periodColors: Record<string, string> = {
    daily: 'from-[#97D700] to-[#82B800]',      // Kanva Lime Green
    weekly: 'from-[#17351A] to-[#0D1F0E]',     // Dark Fir
    monthly: 'from-[#93D500] to-[#7AB800]',    // Kanva Green
    quarterly: 'from-[#F59F2D] to-[#E08A1A]'   // Drippy Tangerine
  };

  const goalFields = [
    { key: 'phone_call_quantity', label: 'Phone Calls', icon: <Phone className="w-4 h-4" />, color: 'text-[#93D500]' },
    { key: 'email_quantity', label: 'Emails', icon: <Mail className="w-4 h-4" />, color: 'text-[#97D700]' },
    { key: 'sms_quantity', label: 'Text Messages', icon: <MessageSquare className="w-4 h-4" />, color: 'text-[#F59F2D]' },
    { key: 'lead_progression_a', label: 'Fact Finding (A)', icon: <Users className="w-4 h-4" />, color: 'text-[#17351A]' },
    { key: 'lead_progression_b', label: 'Contact Stage (B)', icon: <Users className="w-4 h-4" />, color: 'text-[#17351A]' },
    { key: 'lead_progression_c', label: 'Closing Stage (C)', icon: <Users className="w-4 h-4" />, color: 'text-[#17351A]' },
    { key: 'new_sales_wholesale', label: 'Wholesale Sales', icon: <DollarSign className="w-4 h-4" />, color: 'text-[#93D500]', isCurrency: true },
    { key: 'new_sales_distribution', label: 'Distribution Sales', icon: <DollarSign className="w-4 h-4" />, color: 'text-[#93D500]', isCurrency: true },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#17351A] to-[#0D1F0E] rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-[#93D500] rounded-xl flex items-center justify-center shadow-lg">
            <Target className="w-6 h-6 text-[#17351A]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Team Goals</h2>
            <p className="text-gray-300 text-sm">Organization-wide targets for all team members</p>
          </div>
        </div>
        <div className="bg-[#93D500]/10 border border-[#93D500]/20 rounded-lg p-4 mt-4">
          <p className="text-sm text-gray-200">
            💡 <strong className="text-white">Tip:</strong> These goals apply to all users. Individual team members can still set their own personal goals.
          </p>
        </div>
      </div>

      {/* Period Cards */}
      {['daily', 'weekly', 'monthly', 'quarterly'].map((period) => (
        <div key={period} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Period Header */}
          <div className={`bg-gradient-to-r ${periodColors[period]} p-6 text-white`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                {periodIcons[period]}
              </div>
              <div>
                <h3 className="text-xl font-bold capitalize">{period} Goals</h3>
                <p className="text-sm text-white/80">Set targets for the {period} period</p>
              </div>
            </div>
          </div>

          {/* Goals Grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goalFields.map((field) => (
                <div key={field.key} className={`${field.isCurrency ? 'md:col-span-2 lg:col-span-1' : ''}`}>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <span className={field.color}>{field.icon}</span>
                    {field.label}
                  </label>
                  <div className="relative">
                    {field.isCurrency && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                    )}
                    <input
                      type="number"
                      value={teamGoals[period][field.key]}
                      onChange={(e) => setTeamGoals({
                        ...teamGoals,
                        [period]: { ...teamGoals[period], [field.key]: Number(e.target.value) }
                      })}
                      onFocus={(e) => e.target.select()}
                      className={`w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#93D500] focus:ring-2 focus:ring-[#93D500]/20 transition-all ${field.isCurrency ? 'pl-8' : ''}`}
                      placeholder="Enter value"
                      min="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Save Button */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Ready to save?</h4>
            <p className="text-sm text-gray-600 mt-1">Changes will apply to all team members immediately</p>
          </div>
          <button
            onClick={() => setShowPwd(true)}
            disabled={loading}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#93D500] to-[#7AB800] text-[#17351A] font-bold hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-[#17351A]/30 border-t-[#17351A] rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Target className="w-5 h-5" />
                Save Team Goals
              </>
            )}
          </button>
        </div>
      </div>

      {/* Password Modal */}
      {showPwd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#93D500] to-[#7AB800] flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-[#17351A]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Confirm Changes</h3>
                <p className="text-sm text-gray-500">Secure your team goals</p>
              </div>
            </div>
            
            <div className="bg-[#F59F2D]/10 border border-[#F59F2D]/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-[#17351A]">
                🔒 Enter your password to save these team goals. This action will update targets for all team members.
              </p>
            </div>
            
            <input
              type="password"
              value={pwdInput}
              onChange={(e) => setPwdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveTeamGoals()}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-6 focus:border-[#93D500] focus:ring-2 focus:ring-[#93D500]/20 transition-all"
              placeholder="Enter your password"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button
                onClick={saveTeamGoals}
                disabled={!pwdInput}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#93D500] to-[#7AB800] text-[#17351A] font-bold hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Confirm & Save
              </button>
              <button
                onClick={() => { setShowPwd(false); setPwdInput(''); }}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
