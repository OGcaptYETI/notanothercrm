'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function DataSyncTab() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copperUserEmail, setCopperUserEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const syncNow = async () => {
    if (!copperUserEmail) {
      toast.error('Please enter a Copper User Email to sync');
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      const body: any = { 
        period,
        copperUserEmail,
      };
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;

      const res = await fetch('/api/sync-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Sync error:', data);
        throw new Error(data?.error || data?.message || 'Sync failed');
      }
      setResult(data);
      const metrics = data.metrics || {};
      const total = (metrics.emails || 0) + (metrics.calls || 0) + (metrics.leadProgressions || 0) + (metrics.sales?.total || 0);
      if (total === 0 && data.metrics?.warnings?.length > 0) {
        toast.error('Sync returned 0 results - check warnings below');
      } else {
        toast.success(`Sync complete! ${metrics.emails || 0} emails, ${metrics.calls || 0} calls`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Sync failed');
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(end.getDate() - 90));
    const url = `/api/admin/export-metrics?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}&salesOnly=1`;
    window.location.href = url;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Data Sync</h2>
        <p className="text-sm text-gray-600">Trigger a manual sync from Copper for the selected period.</p>
      </div>

      {/* Sync Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Copper User Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={copperUserEmail}
            onChange={(e) => setCopperUserEmail(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
            placeholder="ben@kanvabotanicals.com"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Email of the user to sync data for</p>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Start Date (optional)</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">End Date (optional)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={syncNow}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-kanva-green text-white hover:bg-green-600 disabled:bg-gray-400"
        >
          {loading ? 'Syncing...' : 'Sync Now'}
        </button>
        <button
          onClick={() => {
            const end = new Date();
            const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(end.toISOString().split('T')[0]);
          }}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
        >
          Last 90 days
        </button>
        <button
          onClick={() => { setStartDate(''); setEndDate(''); }}
          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
        >
          Clear Dates
        </button>
      </div>

      {/* Sync Results */}
      {result && (
        <div className="border-t pt-6 space-y-4">
          <h3 className="text-md font-medium">Sync Results</h3>
          
          {/* Error Display */}
          {result.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">❌ Sync Failed</h4>
              <p className="text-sm text-red-700">{result.error}</p>
            </div>
          )}

          {/* Metrics Tiles */}
          {!result.error && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">Emails</div>
                  <div className="text-2xl font-bold text-blue-600">{result.metrics?.emails || 0}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">Calls</div>
                  <div className="text-2xl font-bold text-green-600">{result.metrics?.calls || 0}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">Leads</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {Object.values(result.metrics?.stages || {}).reduce((a: number, b: any) => a + b, 0)}
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">Sales</div>
                  <div className="text-2xl font-bold text-orange-600">{result.metrics?.sales?.total || 0}</div>
                </div>
              </div>

              {/* Sync Details */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-800 mb-3">🔍 Sync Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">User ID:</span>
                    <span className="ml-2 font-mono text-xs">{result.userId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Period:</span>
                    <span className="ml-2 font-medium">{result.period || 'N/A'}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-600">Date Range:</span>
                    <span className="ml-2 font-mono text-xs">
                      {result.start ? new Date(result.start).toLocaleDateString() : 'N/A'} → {result.end ? new Date(result.end).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {result.metrics?.warnings && result.metrics.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Warnings</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {result.metrics.warnings.map((w: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span>•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Zero Results Diagnostic */}
              {(result.metrics?.emails || 0) === 0 && (result.metrics?.calls || 0) === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">🔍 Why Zero Results?</h4>
                  <ul className="text-sm text-blue-700 space-y-2">
                    <li>• <strong>Check Copper user mapping:</strong> Is {copperUserEmail} in Copper with activities?</li>
                    <li>• <strong>Check date range:</strong> Are there activities in the selected period?</li>
                    <li>• <strong>Check activity types:</strong> Email ID: 2279550, Phone ID: 2160510</li>
                    <li>• <strong>Run diagnostic:</strong> Go to Copper Setup → Email Diagnostics</li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Data Export */}
      <div className="border-t pt-6">
        <h3 className="text-md font-medium mb-4">Data Export</h3>
        <p className="text-sm text-gray-600 mb-4">
          Export all Sales team user metrics by day and type as CSV (Excel compatible). Uses the Start/End Dates above if provided; otherwise defaults to last 90 days.
        </p>
        <button
          onClick={exportCsv}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          Export CSV (Sales only)
        </button>
      </div>
    </div>
  );
}
