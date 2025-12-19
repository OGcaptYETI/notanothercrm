'use client';

import React from 'react';
import { Goal, GoalType, GoalPeriod } from '@/types';
import { TrendingUp, TrendingDown, Target, Clock, Mail, MessageSquare, Users, DollarSign } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface GoalCardProps {
  goal: Goal;
  onEdit?: () => void;
  compact?: boolean;
}

const goalIcons: Record<GoalType, React.ReactNode> = {
  'phone_call_quantity': <Clock className="w-5 h-5" />,
  'talk_time_minutes': <Clock className="w-5 h-5" />,
  'email_quantity': <Mail className="w-5 h-5" />,
  'sms_quantity': <MessageSquare className="w-5 h-5" />,
  'lead_progression_a': <Users className="w-5 h-5" />,
  'lead_progression_b': <Users className="w-5 h-5" />,
  'lead_progression_c': <Users className="w-5 h-5" />,
  'new_sales_wholesale': <DollarSign className="w-5 h-5" />,
  'new_sales_distribution': <DollarSign className="w-5 h-5" />
};

const goalLabels: Record<GoalType, string> = {
  'phone_call_quantity': 'Phone Calls',
  'talk_time_minutes': 'Talk Time (min)',
  'email_quantity': 'Emails Sent',
  'sms_quantity': 'Text Messages',
  'lead_progression_a': 'Fact Finding',
  'lead_progression_b': 'Contact Stage',
  'lead_progression_c': 'Closing Stage',
  'new_sales_wholesale': 'Wholesale Sales',
  'new_sales_distribution': 'Distribution Sales'
};

const formatValue = (value: number, type: GoalType): string => {
  if (type === 'phone_call_quantity') return `${value}`;
  if (type === 'talk_time_minutes') return `${value}m`;
  if (type.includes('sales')) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value);
  }
  return value.toString();
};

// Calculate current period dates dynamically
const getCurrentPeriodDates = (period: GoalPeriod): { start: Date; end: Date } => {
  const now = new Date();
  switch (period) {
    case 'daily':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'weekly':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'monthly':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarterly':
      const quarter = Math.floor(now.getMonth() / 3);
      const qStart = new Date(now.getFullYear(), quarter * 3, 1);
      const qEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      return { start: qStart, end: qEnd };
    default:
      return { start: now, end: now };
  }
};

export default function GoalCard({ goal, onEdit, compact = false }: GoalCardProps) {
  const percentage = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
  const isAhead = percentage >= 100;
  const isOnTrack = percentage >= 80 && percentage < 100;
  const isBehind = percentage < 80;
  
  // Calculate current period dates (not stored dates)
  const { start: periodStart, end: periodEnd } = getCurrentPeriodDates(goal.period);

  const progressColor = isAhead 
    ? 'bg-green-500' 
    : isOnTrack 
    ? 'bg-yellow-500' 
    : 'bg-red-500';

  const statusColor = isAhead
    ? 'text-green-600 bg-green-50'
    : isOnTrack
    ? 'text-yellow-600 bg-yellow-50'
    : 'text-red-600 bg-red-50';

  if (compact) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-kanva transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="text-kanva-green">{goalIcons[goal.type]}</div>
            <span className="text-sm font-medium text-gray-700">
              {goalLabels[goal.type]}
            </span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${statusColor}`}>
            {percentage.toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between items-end">
          <span className="text-lg font-bold text-gray-900">
            {formatValue(goal.current, goal.type)}
          </span>
          <span className="text-sm text-gray-500">
            / {formatValue(goal.target, goal.type)}
          </span>
        </div>
        <div className="mt-2 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${progressColor} transition-all duration-300`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-kanva hover:shadow-kanva-lg transition-shadow p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-kanva-lightGreen rounded-lg text-kanva-green">
            {goalIcons[goal.type]}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {goalLabels[goal.type]}
            </h3>
            <span className="text-xs text-gray-500 capitalize">
              {goal.period} Goal
            </span>
          </div>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-sm text-kanva-green hover:text-kanva-sage transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-2xl font-bold text-gray-900">
            {formatValue(goal.current, goal.type)}
          </span>
          <span className="text-sm text-gray-500">
            of {formatValue(goal.target, goal.type)}
          </span>
        </div>

        <div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full ${progressColor} transition-all duration-500 ease-out`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={`flex items-center gap-1 px-2 py-1 rounded-lg ${statusColor}`}>
            {isAhead ? (
              <>
                <TrendingUp className="w-4 h-4" />
                Goal Achieved!
              </>
            ) : isOnTrack ? (
              <>
                <Target className="w-4 h-4" />
                On Track
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4" />
                Behind Pace
              </>
            )}
          </span>
          <span className="text-gray-600 font-medium">
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Time remaining */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Started: {periodStart.toLocaleDateString()}</span>
          <span>Ends: {periodEnd.toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}