'use client';

import { useState, useEffect } from 'react';
import { Upload, RefreshCw, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

interface CustomerWithMetrics {
  id: string;
  name: string;
  copperCompanyId: string;
  copperCompanyName: string;
  accountId: string;
  metrics?: {
    totalOrders: number;
    totalSpent: number;
    firstOrderDate: string | null;
    lastOrderDate: string | null;
    averageOrderValue: number;
    daysSinceLastOrder: number | null;
  };
  metricsCalculatedAt?: string;
  syncedToCopperAt?: string;
  status?: 'pending' | 'synced' | 'error';
  syncError?: string | null;
}

export default function SyncFishbowlCopperPage() {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [customers, setCustomers] = useState<CustomerWithMetrics[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'synced' | 'error'>('all');
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [cleanupStats, setCleanupStats] = useState<{ deletedFromCopper: number; deletedFromStaging: number } | null>(null);
  const [calcProgress, setCalcProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  const calculateMetrics = async () => {
    setCalculating(true);
    setError(null);
    
    // Show initial progress immediately
    setCalcProgress({
      current: 0,
      total: 1440,
      message: 'Starting calculation...'
    });
    
    try {
      // Get Firebase auth token
      const { auth } = await import('@/lib/firebase/client');
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated. Please log in.');
      }

      const token = await user.getIdToken();

      // Start polling for progress
      const progressInterval = setInterval(async () => {
        try {
          const progressRes = await fetch('/api/fishbowl/calculate-metrics-progress');
          if (progressRes.ok) {
            const progressData = await progressRes.json();
            if (progressData.success && progressData.progress.isRunning) {
              setCalcProgress({
                current: progressData.progress.current,
                total: progressData.progress.total,
                message: progressData.progress.message,
              });
            }
          }
        } catch (err) {
          console.error('Progress polling error:', err);
        }
      }, 500); // Poll every 500ms for more responsive updates

      const response = await fetch('/api/fishbowl/calculate-metrics', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Stop polling
      clearInterval(progressInterval);
      setCalcProgress(null);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate metrics');
      }

      const data = await response.json();
      setStats(data.stats);
      
      // Reload customers to show updated metrics
      await loadCustomers();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCalculating(false);
      setCalcProgress(null);
    }
  };

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load from staging collection (persists across refreshes)
      const response = await fetch('/api/fishbowl/get-staged-metrics');
      
      if (!response.ok) {
        throw new Error('Failed to load staged metrics');
      }

      const data = await response.json();
      
      // Transform staged metrics to match UI format
      const transformedCustomers = data.metrics.map((m: any) => ({
        id: m.customerId,
        name: m.customerName,
        copperCompanyId: m.copperCompanyId,
        copperCompanyName: m.copperCompanyName,
        accountId: m.accountId,
        metrics: m.metrics,
        metricsCalculatedAt: m.calculatedAt,
        syncedToCopperAt: m.syncedAt,
        status: m.status,
        syncError: m.syncError,
      }));
      
      setCustomers(transformedCustomers);
      
      // Find the most recent sync date
      const syncedCustomers = transformedCustomers.filter((c: any) => c.syncedToCopperAt);
      if (syncedCustomers.length > 0) {
        const mostRecent = syncedCustomers.reduce((latest: any, current: any) => {
          return new Date(current.syncedToCopperAt) > new Date(latest.syncedToCopperAt) ? current : latest;
        });
        setLastSyncDate(mostRecent.syncedToCopperAt);
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load staged metrics on component mount
  useEffect(() => {
    loadCustomers();
    checkForRunningProcesses();
  }, []);

  // Check if any processes are running in the background
  const checkForRunningProcesses = async () => {
    try {
      // Check calculation progress
      const calcRes = await fetch('/api/fishbowl/calculate-metrics-progress');
      if (calcRes.ok) {
        const calcData = await calcRes.json();
        if (calcData.success && calcData.progress.isRunning) {
          console.log('📊 Detected running calculation process');
          setCalculating(true);
          setCalcProgress({
            current: calcData.progress.current,
            total: calcData.progress.total,
            message: calcData.progress.message,
          });
          // Start polling for calculation progress
          startCalcProgressPolling();
        }
      }

      // Check sync progress
      const syncRes = await fetch('/api/fishbowl-goals/sync-progress');
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.success && syncData.progress.isRunning) {
          console.log('🔄 Detected running sync process');
          setSyncing(true);
          setProgress({
            current: syncData.progress.current,
            total: syncData.progress.total,
          });
          // Start polling for sync progress
          startSyncProgressPolling();
        }
      }
    } catch (err) {
      console.error('Error checking for running processes:', err);
    }
  };

  // Start polling for calculation progress
  const startCalcProgressPolling = () => {
    const interval = setInterval(async () => {
      try {
        const progressRes = await fetch('/api/fishbowl/calculate-metrics-progress');
        if (progressRes.ok) {
          const progressData = await progressRes.json();
          if (progressData.success && progressData.progress.isRunning) {
            setCalcProgress({
              current: progressData.progress.current,
              total: progressData.progress.total,
              message: progressData.progress.message,
            });
          } else {
            // Process completed
            clearInterval(interval);
            setCalculating(false);
            setCalcProgress(null);
            loadCustomers(); // Reload data
          }
        }
      } catch (err) {
        console.error('Progress polling error:', err);
      }
    }, 500);
  };

  // Start polling for sync progress
  const startSyncProgressPolling = () => {
    const interval = setInterval(async () => {
      try {
        const progressRes = await fetch('/api/fishbowl-goals/sync-progress');
        if (progressRes.ok) {
          const progressData = await progressRes.json();
          if (progressData.success && progressData.progress.isRunning) {
            setProgress({
              current: progressData.progress.current,
              total: progressData.progress.total,
            });
          } else {
            // Process completed
            clearInterval(interval);
            setSyncing(false);
            setProgress({ current: 0, total: 0 });
            loadCustomers(); // Reload data
          }
        }
      } catch (err) {
        console.error('Sync progress polling error:', err);
      }
    }, 500);
  };

  const syncToCopper = async () => {
    const customersWithMetrics = customers.filter(c => c.metrics);
    
    if (customersWithMetrics.length === 0) {
      setError('No customers with metrics to sync. Run Step 1 first.');
      return;
    }

    setSyncing(true);
    setError(null);
    setProgress({ current: 0, total: customersWithMetrics.length });
    
    try {
      // Start polling for sync progress
      const syncProgressInterval = setInterval(async () => {
        try {
          const progressRes = await fetch('/api/fishbowl-goals/sync-progress');
          if (progressRes.ok) {
            const progressData = await progressRes.json();
            if (progressData.success && progressData.progress.isRunning) {
              setProgress({
                current: progressData.progress.current,
                total: progressData.progress.total,
              });
            }
          }
        } catch (err) {
          console.error('Sync progress polling error:', err);
        }
      }, 500); // Poll every 500ms

      const response = await fetch('/api/fishbowl-goals/sync-to-copper', {
        method: 'POST',
      });

      // Stop polling
      clearInterval(syncProgressInterval);

      if (!response.ok) {
        throw new Error('Failed to sync to Copper');
      }

      const data = await response.json();
      
      // Reload to show sync status
      await loadCustomers();
      
      // Update last sync date
      setLastSyncDate(new Date().toISOString());
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
    setDeleteConfirmText('');
  };

  const cleanupDeletedCompanies = async () => {
    setShowDeleteModal(false);
    setCleaningUp(true);
    setError(null);
    
    try {
      const response = await fetch('/api/fishbowl/cleanup-deleted-companies', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup deleted companies');
      }

      const data = await response.json();
      
      // Store stats and show success modal
      setCleanupStats(data.stats);
      setShowSuccessModal(true);
      
      // Reload to show updated list
      await loadCustomers();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCleaningUp(false);
    }
  };

  const customersWithMetrics = customers.filter(c => c.metrics);
  const customersWithoutMetrics = customers.filter(c => !c.metrics);
  const customersSynced = customers.filter(c => c.status === 'synced');
  const customersPending = customers.filter(c => c.status === 'pending');
  const customersError = customers.filter(c => c.status === 'error');
  
  // Apply status filter
  const filteredCustomers = statusFilter === 'all' 
    ? customers 
    : customers.filter(c => c.status === statusFilter);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-kanva-green" />
              Sync Fishbowl Metrics → Copper
            </h1>
            <p className="text-gray-600 mt-2">
              Calculate customer metrics from sales orders and push to Copper CRM
            </p>
            {lastSyncDate && (
              <p className="text-sm text-gray-500 mt-1">
                Last synced: {new Date(lastSyncDate).toLocaleString()}
              </p>
            )}
          </div>
          <a href="/admin" className="text-sm text-kanva-green hover:underline">
            ← Back to Admin
          </a>
        </div>

        {/* How It Works */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">How It Works:</h2>
          <div className="space-y-2 text-sm text-blue-800">
            <p><strong>Step 1:</strong> Calculate metrics from Fishbowl sales orders (Total Orders, Lifetime Value, etc.)</p>
            <p><strong>Step 2:</strong> Store metrics in Firestore for preview</p>
            <p><strong>Step 3:</strong> Push metrics to Copper CRM custom fields</p>
          </div>
        </div>

        {/* Calculation Progress Bar - Full Width */}
        {calcProgress && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-700 font-semibold">{calcProgress.message}</span>
              <span className="text-gray-600 font-medium">{calcProgress.current} / {calcProgress.total} customers</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                style={{ width: `${(calcProgress.current / calcProgress.total) * 100}%` }}
              >
                <span className="text-xs text-white font-semibold">
                  {Math.round((calcProgress.current / calcProgress.total) * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Syncing Progress Bar - Full Width */}
        {syncing && progress && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-700 font-semibold">Syncing to Copper CRM...</span>
              <span className="text-gray-600 font-medium">{progress.current} / {progress.total} customers</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-purple-600 h-4 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              >
                <span className="text-xs text-white font-semibold">
                  {Math.round((progress.current / progress.total) * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {customers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">With Metrics</p>
              <p className="text-2xl font-bold text-blue-600">{customersWithMetrics.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Synced to Copper</p>
              <p className="text-2xl font-bold text-green-600">{customersSynced.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-orange-600">{customersPending.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Errors</p>
              <p className="text-2xl font-bold text-red-600">{customersError.length}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={calculateMetrics}
              disabled={calculating}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg"
            >
              <RefreshCw className={`w-5 h-5 ${calculating ? 'animate-spin' : ''}`} />
              {calculating ? 'Calculating...' : 'Step 1: Calculate Metrics'}
            </button>

            <button
              onClick={loadCustomers}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-kanva-green text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Step 2: Refresh Preview'}
            </button>

            {customersPending.length > 0 && (
              <button
                onClick={syncToCopper}
                disabled={syncing}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg"
              >
                <CheckCircle className="w-5 h-5" />
                {syncing ? 'Syncing...' : `Step 3: Sync ${customersPending.length} to Copper`}
              </button>
            )}

            {customersError.length > 0 && (
              <button
                onClick={handleDeleteClick}
                disabled={cleaningUp}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg"
              >
                <AlertCircle className="w-5 h-5" />
                {cleaningUp ? 'Cleaning up...' : `Clean Up ${customersError.length} Errors`}
              </button>
            )}
          </div>

        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats from Calculation */}
        {stats && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-green-900 mb-3">✅ Metrics Calculated!</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-green-700">Total Customers</p>
                <p className="text-2xl font-bold text-green-900">{stats.totalCustomers}</p>
              </div>
              <div>
                <p className="text-green-700">Updated</p>
                <p className="text-2xl font-bold text-green-900">{stats.updated}</p>
              </div>
              <div>
                <p className="text-green-700">Total Orders</p>
                <p className="text-2xl font-bold text-green-900">{stats.totalOrders?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-green-700">Skipped</p>
                <p className="text-2xl font-bold text-green-900">{stats.skipped}</p>
              </div>
            </div>
          </div>
        )}

        {/* Customers Table */}
        {customers.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Customers with Metrics ({filteredCustomers.length})
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      statusFilter === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All ({customers.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('synced')}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      statusFilter === 'synced'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    Synced ({customersSynced.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      statusFilter === 'pending'
                        ? 'bg-orange-600 text-white'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`}
                  >
                    Pending ({customersPending.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('error')}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      statusFilter === 'error'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    Errors ({customersError.length})
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lifetime Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.slice(0, 100).map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        <div className="text-xs text-gray-500">→ {customer.copperCompanyName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.metrics?.totalOrders || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${customer.metrics?.totalSpent.toLocaleString() || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${customer.metrics?.averageOrderValue.toLocaleString() || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.metrics?.lastOrderDate ? new Date(customer.metrics.lastOrderDate).toLocaleDateString() : '-'}
                        {customer.metrics?.daysSinceLastOrder && (
                          <div className="text-xs text-gray-500">
                            {customer.metrics.daysSinceLastOrder} days ago
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.status === 'synced' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Synced
                          </span>
                        ) : customer.status === 'error' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Error
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-red-600">
                        {customer.syncError ? (
                          <div className="max-w-xs truncate" title={customer.syncError}>
                            {customer.syncError}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredCustomers.length > 100 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing first 100 of {filteredCustomers.length} customers
                </p>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
                </div>
                
                <p className="text-sm text-gray-700 mb-4">
                  This will permanently delete <strong>{customersError.length} companies</strong> from your database that no longer exist in Copper.
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800 font-medium">⚠️ This action cannot be undone!</p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="DELETE"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={cleanupDeletedCompanies}
                    disabled={deleteConfirmText !== 'DELETE'}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                  >
                    Delete {customersError.length} Companies
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && cleanupStats && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Cleanup Complete!</h3>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800 font-medium mb-2">✅ Successfully cleaned up deleted companies</p>
                    <div className="space-y-1 text-sm text-green-700">
                      <p>• Deleted <strong>{cleanupStats.deletedFromCopper}</strong> companies from database</p>
                      <p>• Removed <strong>{cleanupStats.deletedFromStaging}</strong> error records from staging</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    Your database is now in sync with Copper CRM. These companies will no longer appear in future calculations.
                  </p>
                </div>

                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
