// Goal Labels and Display Utilities for Goals Tracker

import { GoalType, GoalPeriod } from '@/types';

export const goalTypeLabels: Record<GoalType, string> = {
  calls: 'Phone Calls',
  meetings: 'Meetings',
  demos: 'Demos',
  sales: 'Sales',
  revenue: 'Revenue',
  talk_time: 'Talk Time',
  phone_call_quantity: 'Phone Calls',
  email_quantity: 'Emails Sent',
  sms_quantity: 'SMS Messages',
  lead_progression_a: 'Lead Progression A',
  lead_progression_b: 'Lead Progression B',
  lead_progression_c: 'Lead Progression C',
  new_sales_wholesale: 'New Wholesale Sales',
  new_sales_distribution: 'New Distribution Sales',
  talk_time_minutes: 'Talk Time (Minutes)',
};

export const goalPeriodLabels: Record<GoalPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

export function getGoalTypeLabel(type: GoalType): string {
  return goalTypeLabels[type] || type;
}

export function getGoalPeriodLabel(period: GoalPeriod): string {
  return goalPeriodLabels[period] || period;
}

export function getGoalIcon(type: GoalType): string {
  const icons: Partial<Record<GoalType, string>> = {
    calls: '📞',
    phone_call_quantity: '📞',
    meetings: '🤝',
    demos: '🎯',
    sales: '💰',
    revenue: '💵',
    talk_time: '⏱️',
    talk_time_minutes: '⏱️',
    email_quantity: '📧',
    sms_quantity: '💬',
    lead_progression_a: '📈',
    lead_progression_b: '📊',
    lead_progression_c: '📉',
    new_sales_wholesale: '🏪',
    new_sales_distribution: '🚚',
  };
  return icons[type] || '📋';
}

export function formatGoalValue(value: number, type: GoalType | string | undefined): string {
  const typeStr = String(type || '');
  if (typeStr.includes('sales') || typeStr.includes('revenue')) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (typeStr.includes('time') || typeStr.includes('minutes')) {
    const hours = Math.floor(value / 60);
    const mins = Math.round(value % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
