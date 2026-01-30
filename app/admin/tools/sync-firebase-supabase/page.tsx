'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Database, CheckCircle, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';

interface SyncStatus {
  firebaseCustomers: number;
  supabaseAccounts: number;
  needsSync: boolean;
  difference: number;
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
  summary: string;
}

export default function SyncFirebaseSupabasePage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkSyncStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/sync-firebase-to-supabase?companyId=kanva-botanicals');
      const data = await res.json();
      
      if (data.success && data.status) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to check sync status:', error);
    } finally {
      setChecking(false);
    }
  };

  const runSync = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sync-firebase-to-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: 'kanva-botanicals' })
      });
      
      const result = await res.json();
      setLastSync(result);
      
      await checkSyncStatus();
      
    } catch (error) {
      console.error('Sync failed:', error);
      setLastSync({
        success: false,
        synced: 0,
        failed: 0,
        errors: [(error as Error).message],
        summary: 'Sync failed'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSyncStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🔄 Firebase → Supabase Sync</h1>
            <p className="text-gray-600">
              Keep CRM accounts synchronized with Fishbowl customer data
            </p>
          </div>
          <a href="/admin/tools" className="text-sm text-kanva-green hover:underline">
            ← Back to Tools
          </a>
        </div>

        {/* Sync Status */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Current Sync Status</h2>
            </div>
          </div>
          <div className="p-6">
            {status ? (
              <div className="space-y-4">
                {/* Count Display */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg bg-blue-50">
                    <div className="text-sm text-gray-600 mb-1">Firebase Customers</div>
                    <div className="text-3xl font-bold text-blue-600">
                      {status.firebaseCustomers.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      fishbowl_customers collection
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <ArrowRight className="h-8 w-8 text-gray-400" />
                  </div>

                  <div className="p-4 border rounded-lg bg-green-50">
                    <div className="text-sm text-gray-600 mb-1">Supabase Accounts</div>
                    <div className="text-3xl font-bold text-green-600">
                      {status.supabaseAccounts.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      accounts table (source: fishbowl)
                    </div>
                  </div>
                </div>

                {/* Sync Status Indicator */}
                <div className={`p-4 border rounded-lg ${
                  status.needsSync 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {status.needsSync ? (
                      <>
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <span className="font-semibold text-yellow-700">
                          Sync Needed
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-700">
                          In Sync
                        </span>
                      </>
                    )}
                  </div>
                  {status.needsSync && (
                    <div className="text-sm text-gray-600">
                      {status.difference > 0 
                        ? `${status.difference} customers need to be synced to Supabase`
                        : `${Math.abs(status.difference)} extra records in Supabase`
                      }
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button 
                    onClick={runSync} 
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-kanva-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Run Sync Now
                      </>
                    )}
                  </button>
                  
                  <button 
                    onClick={checkSyncStatus} 
                    disabled={checking}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                  >
                    {checking ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Refresh Status
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                Loading sync status...
              </div>
            )}
          </div>
        </div>

        {/* Last Sync Result */}
        {lastSync && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                {lastSync.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <h2 className="text-lg font-semibold text-gray-900">Last Sync Result</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Summary:</span>
                  <span className={lastSync.success ? 'text-green-600' : 'text-red-600'}>
                    {lastSync.summary}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Synced</div>
                    <div className="text-2xl font-bold text-green-600">
                      {lastSync.synced}
                    </div>
                  </div>
                  
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Failed</div>
                    <div className="text-2xl font-bold text-red-600">
                      {lastSync.failed}
                    </div>
                  </div>
                </div>

                {lastSync.errors && lastSync.errors.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="font-medium text-red-700 mb-2">Errors:</div>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                      {lastSync.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* How It Works */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">How Sync Works</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-1">🔄 Automatic Sync</h4>
                <p className="text-gray-600">
                  Every Fishbowl import automatically syncs customers to Supabase accounts table.
                  No manual action required after imports.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-1">🎯 What Gets Synced</h4>
                <p className="text-gray-600">
                  Customer data from <code className="bg-gray-100 px-1 rounded">fishbowl_customers</code> (Firebase) 
                  → <code className="bg-gray-100 px-1 rounded">accounts</code> (Supabase)
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-600 space-y-1">
                  <li>Customer name, contact info, address</li>
                  <li>Account type, region, segment</li>
                  <li>Payment terms, order history</li>
                  <li>Status and priority flags</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-1">🔁 Manual Sync</h4>
                <p className="text-gray-600">
                  Use the &quot;Run Sync Now&quot; button above to manually sync if needed.
                  Useful for troubleshooting or catching up after bulk changes.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-1">💾 Data Flow</h4>
                <div className="bg-gray-50 p-3 rounded-lg font-mono text-xs space-y-1 text-gray-700">
                  <div>1. Import Fishbowl CSV → Firebase (fishbowl_customers)</div>
                  <div>2. Sync Service → Reads Firebase customers</div>
                  <div>3. Maps to Supabase format → Upserts to accounts table</div>
                  <div>4. CRM shows current customer list ✅</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
