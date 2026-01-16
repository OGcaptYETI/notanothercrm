import { NextRequest, NextResponse } from 'next/server';

// In-memory progress state
let syncProgress = {
  isRunning: false,
  current: 0,
  total: 0,
  message: '',
  startedAt: null as Date | null,
};

export function updateSyncProgress(current: number, total: number, message: string) {
  syncProgress = {
    isRunning: true,
    current,
    total,
    message,
    startedAt: syncProgress.startedAt || new Date(),
  };
}

export function resetSyncProgress() {
  syncProgress = {
    isRunning: false,
    current: 0,
    total: 0,
    message: '',
    startedAt: null,
  };
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    progress: syncProgress,
  });
}
