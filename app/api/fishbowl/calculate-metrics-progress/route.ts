import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const maxDuration = 10;

// Store progress in memory (simple in-memory cache)
let calculationProgress = {
  isRunning: false,
  current: 0,
  total: 0,
  message: '',
  startedAt: null as string | null,
};

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    progress: calculationProgress,
  });
}

export function updateProgress(current: number, total: number, message: string) {
  calculationProgress = {
    isRunning: true,
    current,
    total,
    message,
    startedAt: calculationProgress.startedAt || new Date().toISOString(),
  };
}

export function resetProgress() {
  calculationProgress = {
    isRunning: false,
    current: 0,
    total: 0,
    message: '',
    startedAt: null,
  };
}

export function getProgress() {
  return calculationProgress;
}
