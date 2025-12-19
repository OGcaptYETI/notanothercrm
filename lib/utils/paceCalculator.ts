// Pace Calculator Utilities for Goals Tracker

export interface PaceResult {
  currentPace: number;
  targetPace: number;
  percentOfTarget: number;
  isOnTrack: boolean;
  daysRemaining: number;
  projectedTotal: number;
}

export function calculateDailyPace(
  currentValue: number,
  targetValue: number,
  startDate: Date,
  endDate: Date
): PaceResult {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  
  const currentPace = daysElapsed > 0 ? currentValue / daysElapsed : 0;
  const targetPace = totalDays > 0 ? targetValue / totalDays : 0;
  const percentOfTarget = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
  const projectedTotal = currentPace * totalDays;
  const isOnTrack = currentPace >= targetPace * 0.9; // Within 90% of target pace
  
  return {
    currentPace,
    targetPace,
    percentOfTarget,
    isOnTrack,
    daysRemaining,
    projectedTotal
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

// Calculate pace percentage
export function calculatePace(current: number, target: number, daysElapsed: number, totalDays: number): number {
  if (target === 0 || totalDays === 0) return 0;
  const expectedProgress = (daysElapsed / totalDays) * target;
  if (expectedProgress === 0) return 0;
  return (current / expectedProgress) * 100;
}

// Get pace color based on percentage
export function getPaceColor(pacePercent: number): string {
  if (pacePercent >= 100) return 'text-green-600';
  if (pacePercent >= 80) return 'text-yellow-600';
  return 'text-red-600';
}

// Get pace background color based on percentage
export function getPaceBgColor(pacePercent: number): string {
  if (pacePercent >= 100) return 'bg-green-100';
  if (pacePercent >= 80) return 'bg-yellow-100';
  return 'bg-red-100';
}

// Get pace icon based on percentage
export function getPaceIcon(pacePercent: number): string {
  if (pacePercent >= 100) return '🚀';
  if (pacePercent >= 80) return '📈';
  return '⚠️';
}
