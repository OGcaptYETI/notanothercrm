'use client';

import React, { useState } from 'react';
import { Goal, GoalType, GoalPeriod } from '@/types';
import { goalService } from '@/lib/firebase/services';
import { Target, Calendar, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';

interface GoalSetterProps {
  userId: string;
  goalType: GoalType;
  period: GoalPeriod;
  existingGoal?: Goal;
  onSave?: (goal: Goal) => void;
  onCancel?: () => void;
}

const goalLabels: Record<GoalType, string> = {
  'phone_call_quantity': 'Phone Calls',
  'talk_time_minutes': 'Talk Time (minutes)',
  'email_quantity': 'Emails',
  'sms_quantity': 'Text Messages',
  'lead_progression_a': 'Leads - Fact Finding',
  'lead_progression_b': 'Leads - Contact Stage',
  'lead_progression_c': 'Leads - Closing Stage',
  'new_sales_wholesale': 'Wholesale Sales ($)',
  'new_sales_distribution': 'Distribution Sales ($)'
};

const periodLabels: Record<GoalPeriod, string> = {
  'daily': 'Daily',
  'weekly': 'Weekly',
  'monthly': 'Monthly',
  'quarterly': 'Quarterly'
};

export default function GoalSetter({
  userId,
  goalType,
  period,
  existingGoal,
  onSave,
  onCancel
}: GoalSetterProps) {
  const [target, setTarget] = useState(existingGoal?.target || 0);
  const [isLoading, setIsLoading] = useState(false);

  const getPeriodDates = (period: GoalPeriod) => {
    const now = new Date();
    switch (period) {
      case 'daily':
        return {
          startDate: startOfDay(now),
          endDate: endOfDay(now)
        };
      case 'weekly':
        return {
          startDate: startOfWeek(now, { weekStartsOn: 1 }),
          endDate: endOfWeek(now, { weekStartsOn: 1 })
        };
      case 'monthly':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
      case 'quarterly':
        return {
          startDate: startOfQuarter(now),
          endDate: endOfQuarter(now)
        };
      default:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
    }
  };

  const handleSave = async () => {
    if (target <= 0) {
      toast.error('Please enter a valid target');
      return;
    }

    setIsLoading(true);
    try {
      const dates = getPeriodDates(period);
      const goalData = {
        userId,
        type: goalType,
        period,
        target,
        current: existingGoal?.current || 0,
        startDate: dates.startDate!,
        endDate: dates.endDate!
      };

      const goalId = await goalService.upsertGoal(goalData);
      
      toast.success('Goal saved successfully!');
      
      if (onSave) {
        onSave({
          ...goalData,
          id: goalId,
          createdAt: existingGoal?.createdAt || new Date(),
          updatedAt: new Date()
        } as Goal);
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      toast.error('Failed to save goal');
    } finally {
      setIsLoading(false);
    }
  };

  const getPlaceholder = () => {
    switch (goalType) {
      case 'phone_call_quantity':
        return period === 'daily' ? '20' : period === 'weekly' ? '100' : '400';
      case 'talk_time_minutes':
        return period === 'daily' ? '120' : period === 'weekly' ? '600' : '2400';
      case 'email_quantity':
        return period === 'daily' ? '20' : period === 'weekly' ? '100' : '400';
      case 'lead_progression_a':
      case 'lead_progression_b':
      case 'lead_progression_c':
        return period === 'daily' ? '5' : period === 'weekly' ? '25' : '100';
      case 'new_sales_wholesale':
      case 'new_sales_distribution':
        return period === 'daily' ? '1000' : period === 'weekly' ? '5000' : '20000';
      default:
        return '0';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-kanva p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-kanva-lightGreen rounded-lg">
          <Target className="w-5 h-5 text-kanva-green" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Set {periodLabels[period]} Goal
          </h3>
          <p className="text-sm text-gray-500">
            {goalLabels[goalType]}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Target Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target
          </label>
          <div className="relative">
            {goalType.includes('sales') && (
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-base">
                $
              </span>
            )}
            <input
              type="number"
              value={target || ''}
              onChange={(e) => setTarget(Number(e.target.value))}
              placeholder={getPlaceholder()}
              className={`w-full ${goalType.includes('sales') ? 'pl-8' : 'pl-4'} pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kanva-green focus:border-transparent text-base`}
              min="0"
              step={goalType.includes('sales') ? '100' : '1'}
            />
          </div>
        </div>

        {/* Period Display */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>
            {new Date(getPeriodDates(period).startDate).toLocaleDateString()} - 
            {new Date(getPeriodDates(period).endDate).toLocaleDateString()}
          </span>
        </div>

        {/* Suggestions */}
        <div className="bg-kanva-lightGreen/50 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            <strong>💡 Tip:</strong> Set realistic goals that challenge you but are achievable. 
            {period === 'daily' && ' Daily goals help maintain consistent momentum.'}
            {period === 'weekly' && ' Weekly goals allow for day-to-day flexibility.'}
            {period === 'monthly' && ' Monthly goals focus on long-term outcomes.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={isLoading || target <= 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-kanva-green text-white rounded-lg hover:bg-kanva-sage transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'Saving...' : 'Save Goal'}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}