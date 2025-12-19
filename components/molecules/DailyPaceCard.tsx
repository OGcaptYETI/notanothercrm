'use client';

import React from 'react';
import { Goal } from '@/types';
import { 
  calculatePace, 
  formatMetricValue, 
  getPaceColor, 
  getPaceBgColor,
  getPaceIcon 
} from '@/lib/utils/paceCalculator';
import { getGoalTypeLabel } from '@/lib/utils/goalLabels';
import { TrendingUp, TrendingDown, Target, Calendar } from 'lucide-react';

interface DailyPaceCardProps {
  goal: Goal;
  currentProgress: number;
}

export default function DailyPaceCard({ goal, currentProgress }: DailyPaceCardProps) {
  const pace = calculatePace(goal.period, goal.target, currentProgress);
  const isCurrency = goal.type.includes('sales');
  const label = getGoalTypeLabel(goal.type);
  
  // Get period-specific labels
  const periodLabel = goal.period === 'daily' ? 'Today' : 
                      goal.period === 'weekly' ? 'This Week' : 
                      'This Month';
  const unitLabel = pace.unitLabel === 'hour' ? 'hr' : pace.unitLabel;

  return (
    <div className={`rounded-lg border-2 p-4 ${getPaceBgColor(pace.status)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getPaceIcon(pace.status)}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{label}</h4>
            <p className="text-xs text-gray-600">{periodLabel} Pace</p>
          </div>
        </div>
        <div className={`text-right ${getPaceColor(pace.status)}`}>
          <p className="text-2xl font-bold">
            {Math.round(pace.progressPercentage)}%
          </p>
          <p className="text-xs font-medium uppercase">{pace.status}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Progress</span>
          <span>{formatMetricValue(currentProgress, isCurrency)} / {formatMetricValue(goal.target, isCurrency)}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              pace.status === 'ahead' ? 'bg-green-500' :
              pace.status === 'on-pace' ? 'bg-blue-500' :
              'bg-orange-500'
            }`}
            style={{ width: `${Math.min(pace.progressPercentage, 100)}%` }}
          />
        </div>
        {/* Pace marker */}
        <div className="relative h-1 -mt-1">
          <div 
            className="absolute w-0.5 h-3 bg-gray-400"
            style={{ left: `${Math.min(pace.pacePercentage, 100)}%` }}
            title={`Expected pace: ${Math.round(pace.pacePercentage)}%`}
          />
        </div>
      </div>

      {/* Status Message */}
      <div className="mb-3">
        <p className={`text-sm font-medium ${getPaceColor(pace.status)}`}>
          {pace.statusMessage}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white/50 rounded p-2">
          <p className="text-xs text-gray-600 mb-1">Current Target</p>
          <p className="text-lg font-bold text-gray-900">
            {formatMetricValue(pace.currentTarget, isCurrency)}
            <span className="text-xs text-gray-500">/{unitLabel}</span>
          </p>
        </div>
        <div className="bg-white/50 rounded p-2">
          <p className="text-xs text-gray-600 mb-1">{pace.unitLabel === 'hour' ? 'Hours Left' : `${pace.unitLabel}s Left`}</p>
          <p className="text-lg font-bold text-gray-900">
            {pace.unitsRemaining}
          </p>
        </div>
      </div>

      {/* Detailed Info */}
      <div className="space-y-1 text-xs text-gray-700">
        <div className="flex justify-between">
          <span>Original target per {unitLabel}:</span>
          <span className="font-medium">{formatMetricValue(pace.originalUnitTarget, isCurrency)}</span>
        </div>
        {pace.status !== 'on-pace' && (
          <div className="flex justify-between">
            <span>Adjusted target per {unitLabel}:</span>
            <span className={`font-medium ${getPaceColor(pace.status)}`}>
              {formatMetricValue(pace.adjustedUnitTarget, isCurrency)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Expected by now:</span>
          <span className="font-medium">{formatMetricValue(pace.expectedProgress, isCurrency)}</span>
        </div>
      </div>

      {/* Action Message */}
      {pace.status === 'behind' && (
        <div className="mt-3 pt-3 border-t border-orange-200">
          <p className="text-xs text-gray-700">
            💪 <strong>Action needed:</strong> Hit {formatMetricValue(pace.currentTarget, isCurrency)} per {unitLabel} 
            to get back on track for your {goal.period} goal!
          </p>
        </div>
      )}
      
      {pace.status === 'ahead' && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <p className="text-xs text-gray-700">
            🌟 <strong>Great work!</strong> You only need {formatMetricValue(pace.adjustedUnitTarget, isCurrency)}/{unitLabel} 
            for the rest of the {goal.period === 'daily' ? 'day' : goal.period === 'weekly' ? 'week' : 'month'} to hit your goal!
          </p>
        </div>
      )}
    </div>
  );
}
