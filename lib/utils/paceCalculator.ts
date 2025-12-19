// Pace Calculator Utilities for Goals Tracker

export interface PaceResult {
  status: 'ahead' | 'on-pace' | 'behind';
  statusMessage: string;
  progressPercentage: number;
  pacePercentage: number;
  currentTarget: number;
  unitsRemaining: number;
  unitLabel: string;
  originalUnitTarget: number;
  adjustedUnitTarget: number;
  expectedProgress: number;
}

export function calculatePace(
  period: string,
  target: number,
  currentProgress: number
): PaceResult {
  const now = new Date();
  
  // Calculate period-specific values
  let totalUnits: number;
  let unitsElapsed: number;
  let unitLabel: string;
  
  switch (period) {
    case 'daily':
      totalUnits = 24; // hours in a day
      unitsElapsed = now.getHours() + (now.getMinutes() / 60);
      unitLabel = 'hour';
      break;
    case 'weekly':
      totalUnits = 7; // days in a week
      unitsElapsed = now.getDay() === 0 ? 7 : now.getDay(); // Sunday = end of week
      unitLabel = 'day';
      break;
    case 'monthly':
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      totalUnits = daysInMonth;
      unitsElapsed = now.getDate();
      unitLabel = 'day';
      break;
    case 'quarterly':
      totalUnits = 13; // ~13 weeks in a quarter
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const weeksSinceStart = Math.floor((now.getTime() - quarterStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
      unitsElapsed = weeksSinceStart + 1;
      unitLabel = 'week';
      break;
    default:
      totalUnits = 7;
      unitsElapsed = 1;
      unitLabel = 'day';
  }
  
  const unitsRemaining = Math.max(0, totalUnits - unitsElapsed);
  const pacePercentage = (unitsElapsed / totalUnits) * 100;
  const expectedProgress = (unitsElapsed / totalUnits) * target;
  const progressPercentage = target > 0 ? (currentProgress / target) * 100 : 0;
  
  const originalUnitTarget = target / totalUnits;
  const remaining = Math.max(0, target - currentProgress);
  const adjustedUnitTarget = unitsRemaining > 0 ? remaining / unitsRemaining : remaining;
  const currentTarget = adjustedUnitTarget;
  
  // Determine status
  let status: 'ahead' | 'on-pace' | 'behind';
  let statusMessage: string;
  
  if (currentProgress >= expectedProgress * 1.1) {
    status = 'ahead';
    statusMessage = `You're ahead of schedule! Keep it up!`;
  } else if (currentProgress >= expectedProgress * 0.9) {
    status = 'on-pace';
    statusMessage = `You're on track to hit your goal.`;
  } else {
    status = 'behind';
    statusMessage = `You're behind pace. Time to pick it up!`;
  }
  
  return {
    status,
    statusMessage,
    progressPercentage,
    pacePercentage,
    currentTarget,
    unitsRemaining,
    unitLabel,
    originalUnitTarget,
    adjustedUnitTarget,
    expectedProgress,
  };
}

export function formatPaceValue(value: number, type: string | undefined): string {
  const typeStr = String(type || '');
  if (typeStr.includes('revenue') || typeStr.includes('sales')) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (typeStr.includes('time') || typeStr.includes('minutes')) {
    const hours = Math.floor(value / 60);
    const mins = Math.round(value % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

// Alias for formatPaceValue
export const formatMetricValue = formatPaceValue;

// Get pace color based on status
export function getPaceColor(status: 'ahead' | 'on-pace' | 'behind' | number): string {
  if (typeof status === 'number') {
    if (status >= 100) return 'text-green-600';
    if (status >= 80) return 'text-yellow-600';
    return 'text-red-600';
  }
  switch (status) {
    case 'ahead': return 'text-green-600';
    case 'on-pace': return 'text-blue-600';
    case 'behind': return 'text-orange-600';
    default: return 'text-gray-600';
  }
}

// Get pace background color based on status
export function getPaceBgColor(status: 'ahead' | 'on-pace' | 'behind' | number): string {
  if (typeof status === 'number') {
    if (status >= 100) return 'bg-green-100';
    if (status >= 80) return 'bg-yellow-100';
    return 'bg-red-100';
  }
  switch (status) {
    case 'ahead': return 'bg-green-50 border-green-200';
    case 'on-pace': return 'bg-blue-50 border-blue-200';
    case 'behind': return 'bg-orange-50 border-orange-200';
    default: return 'bg-gray-50 border-gray-200';
  }
}

// Get pace icon based on status
export function getPaceIcon(status: 'ahead' | 'on-pace' | 'behind' | number): string {
  if (typeof status === 'number') {
    if (status >= 100) return '🚀';
    if (status >= 80) return '📈';
    return '⚠️';
  }
  switch (status) {
    case 'ahead': return '🚀';
    case 'on-pace': return '✅';
    case 'behind': return '⚠️';
    default: return '📊';
  }
}
