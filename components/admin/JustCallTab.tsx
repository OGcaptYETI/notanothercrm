'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function JustCallTab() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const syncAllUsers = async () => {
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch('/api/admin/sync-all-justcall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Sync failed');
      setResults(data);
      toast.success(`✅ ${data.message}`);
    } catch (e: any) {
      toast.error(`❌ ${e.message || 'Sync failed'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">JustCall Integration</h2>
        <p className="text-sm text-gray-600">View real-time calling metrics from JustCall API.</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/admin/justcall"
          className="px-4 py-2 rounded-lg bg-kanva-green text-white hover:bg-green-600"
        >
          Open JustCall Dashboard
        </Link>
        <button
          onClick={syncAllUsers}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Syncing All Users...' : 'Sync All JustCall Users (30d)'}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="border-t pt-6">
          <h3 className="text-md font-medium mb-4">Sync Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Users</div>
              <div className="text-2xl font-bold">{results.totalUsers}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Matched</div>
              <div className="text-2xl font-bold text-blue-600">{results.matchedUsers}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Synced</div>
              <div className="text-2xl font-bold text-green-600">{results.syncedUsers}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Calls</div>
              <div className="text-2xl font-bold text-purple-600">{results.totalCalls}</div>
            </div>
          </div>

          {results.results && results.results.length > 0 && (
            <details className="bg-gray-50 rounded-lg p-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                View per-user results ({results.results.length} users)
              </summary>
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {results.results.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{r.userName || r.userEmail}</div>
                      <div className="text-xs text-gray-500">{r.userEmail}</div>
                    </div>
                    <div className={`text-sm font-medium ${r.success ? 'text-green-600' : 'text-red-600'}`}>
                      {r.success ? `✓ ${r.totalCalls || 0} calls` : '✗ Failed'}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Info */}
      <div className="border-t pt-6">
        <h3 className="text-md font-medium mb-2">How It Works</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• Syncs call data for all active users in one click</li>
          <li>• Fetches last 30 days of call history</li>
          <li>• Matches Firestore users with JustCall users by email</li>
          <li>• Updates goals automatically after sync</li>
          <li>• Rate limited to prevent API abuse (500ms delay between users)</li>
        </ul>
      </div>
    </div>
  );
}
