'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Upload, RefreshCw, Database, ChevronDown, ChevronUp } from 'lucide-react';

export default function FishbowlTab() {
  const [loading, setLoading] = useState(false);
  const [fishbowlUsers, setFishbowlUsers] = useState<string[]>([]);
  const [firebaseUsers, setFirebaseUsers] = useState<any[]>([]);
  const [userMapping, setUserMapping] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Unified Import
  const [unifiedFile, setUnifiedFile] = useState<File | null>(null);
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [unifiedResult, setUnifiedResult] = useState<any>(null);
  const unifiedInputRef = useRef<HTMLInputElement>(null);
  
  // Metrics
  const [calculating, setCalculating] = useState(false);
  const [syncingToCopper, setSyncingToCopper] = useState(false);
  const [metricsStats, setMetricsStats] = useState<any>(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [metricsProcessId, setMetricsProcessId] = useState<string | null>(null);
  const [rebuildingInsights, setRebuildingInsights] = useState(false);
  
  // UI State
  const [showAdvanced, setShowAdvanced] = useState(false);

  const rebuildSalesInsightsMetrics = async () => {
    setRebuildingInsights(true);
    try {
      const { auth } = await import('@/lib/firebase/client');
      const user = auth.currentUser;
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/sales-insights/rebuild', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to rebuild Sales Insights metrics');
      }

      toast.success(`Rebuilt Sales Insights metrics for ${data.customersProcessed} customers`);
    } catch (err: any) {
      console.error('[FishbowlTab] Rebuild Sales Insights error:', err);
      toast.error(err.message || 'Failed to rebuild Sales Insights metrics');
    } finally {
      setRebuildingInsights(false);
    }
  };
  
  // Load Fishbowl salesmen and Firebase users
  useEffect(() => {
    loadData();
  }, []);

  // Poll for metrics calculation progress
  useEffect(() => {
    if (!metricsProcessId) return;

    const pollProgress = async () => {
      try {
        const { db } = await import('@/lib/firebase/client');
        const { doc, getDoc } = await import('firebase/firestore');
        
        const progressDoc = await getDoc(doc(db, 'metrics_calculation_progress', metricsProcessId));
        
        if (progressDoc.exists()) {
          const progress = progressDoc.data();
          
          setProcessingStatus(progress.message || 'Processing...');
          
          if (progress.totalRows > 0) {
            const percentage = Math.round((progress.currentRow / progress.totalRows) * 100);
            setProcessingProgress(percentage);
          }
          
          if (progress.status === 'complete') {
            setProcessingProgress(100);
            setProcessingStatus(progress.message);
            setMetricsStats(progress.stats);
            setCalculating(false);
            setMetricsProcessId(null);
            toast.success(`✅ Metrics calculated for ${progress.stats.updated} customers!`);
            
            // Keep modal open for 2 seconds to show success
            setTimeout(() => {
              setShowProcessingModal(false);
            }, 2000);
          } else if (progress.status === 'error') {
            setCalculating(false);
            setMetricsProcessId(null);
            setShowProcessingModal(false);
            toast.error(`Error: ${progress.error}`);
          }
        }
      } catch (err) {
        console.error('Error polling progress:', err);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(pollProgress, 2000);
    pollProgress(); // Initial poll

    return () => clearInterval(interval);
  }, [metricsProcessId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { auth } = await import('@/lib/firebase/client');
      const user = auth.currentUser;
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const token = await user.getIdToken();

      // Load Firebase users
      const usersRes = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const usersData = await usersRes.json();
      if (!usersRes.ok) throw new Error(usersData?.error || 'Failed to load users');
      
      // Filter to sales users
      const salesUsers = (usersData.users || [])
        .filter((u: any) => (u.role === 'sales' || u.role === 'admin') && u.isActive !== false)
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      setFirebaseUsers(salesUsers);

      // Load existing mapping
      const mappingRes = await fetch('/api/admin/fishbowl-mapping', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (mappingRes.ok) {
        const mappingData = await mappingRes.json();
        setUserMapping(mappingData.mapping || {});
      }

      // Load unique Fishbowl salesmen from orders
      const salesmenRes = await fetch('/api/admin/fishbowl-salesmen', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (salesmenRes.ok) {
        const salesmenData = await salesmenRes.json();
        console.log('[Fishbowl Tab] Salesmen data:', salesmenData);
        setFishbowlUsers(salesmenData.salesmen || []);
        
        if (salesmenData.totalCustomers === 0) {
          toast.error('No Fishbowl customers found. Please import Fishbowl data first.');
        } else if (salesmenData.count === 0) {
          toast.error(`Found ${salesmenData.totalCustomers} customers but no salesPerson field. Check server logs.`);
        } else {
          toast.success(`Loaded ${salesmenData.count} salesmen from ${salesmenData.totalCustomers} customers`);
        }
      } else {
        const errorData = await salesmenRes.json();
        throw new Error(errorData?.error || 'Failed to load salesmen');
      }
    } catch (e: any) {
      console.error('[Fishbowl Tab] Error:', e);
      toast.error(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const saveMapping = async () => {
    setLoading(true);
    try {
      const { auth } = await import('@/lib/firebase/client');
      const user = auth.currentUser;
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/admin/fishbowl-mapping', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mapping: userMapping }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save mapping');

      toast.success('Mapping saved successfully!');
    } catch (e: any) {
      console.error('[Fishbowl Tab] Error:', e);
      toast.error(e.message || 'Failed to save mapping');
    } finally {
      setLoading(false);
    }
  };

  const syncSales = async () => {
    setSyncing(true);
    setSyncResults(null);
    try {
      const { auth } = await import('@/lib/firebase/client');
      const user = auth.currentUser;
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/sync-fishbowl-sales', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to sync sales');

      setSyncResults(data);
      toast.success(`Synced ${data.metricsCreated} metrics from ${data.ordersProcessed} orders!`);
    } catch (e: any) {
      console.error('[Fishbowl Tab] Error:', e);
      toast.error(e.message || 'Failed to sync sales');
    } finally {
      setSyncing(false);
    }
  };

  const setLast90Days = () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 90);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleUnifiedImport = async () => {
    if (!unifiedFile) {
      toast.error('Please select the Conversight export file');
      return;
    }

    setUnifiedLoading(true);
    setUnifiedResult(null);

    try {
      const formData = new FormData();
      formData.append('file', unifiedFile);

      const response = await fetch('/api/fishbowl/import-unified', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unified import failed');
      }

      setUnifiedResult(data);
      setUnifiedFile(null);
      if (unifiedInputRef.current) {
        unifiedInputRef.current.value = '';
      }
      
      toast.success(`Imported ${data.stats.customersCreated + data.stats.customersUpdated} customers, ${data.stats.ordersCreated + data.stats.ordersUpdated} orders, ${data.stats.itemsCreated} line items!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUnifiedLoading(false);
    }
  };

  const calculateMetrics = async () => {
    setCalculating(true);
    setShowProcessingModal(true);
    setProcessingStatus('Starting metrics calculation...');
    setProcessingProgress(0);
    
    try {
      const { auth } = await import('@/lib/firebase/client');
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }

      const token = await user.getIdToken();

      // Start the background process
      const response = await fetch('/api/fishbowl/calculate-metrics', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to start metrics calculation');
      }

      const data = await response.json();
      
      // Handle synchronous response (no more processId/polling)
      if (data.success && data.stats) {
        setProcessingStatus(`✅ Complete! Updated ${data.stats.updated} customers in ${data.duration}`);
        setProcessingProgress(100);
        toast.success(`Metrics calculated for ${data.stats.updated} customers!`);
        
        // Close modal after 2 seconds
        setTimeout(() => {
          setShowProcessingModal(false);
          setCalculating(false);
        }, 2000);
      } else if (data.processId) {
        // Fallback: Old async behavior (if Cloud Function is used)
        setMetricsProcessId(data.processId);
      }
      
    } catch (err: any) {
      console.error('Calculate metrics error:', err);
      toast.error(err.message || 'Failed to start metrics calculation');
      setShowProcessingModal(false);
      setCalculating(false);
    }
  };

  const syncToCopper = async () => {
    setSyncingToCopper(true);
    
    try {
      const response = await fetch('/api/fishbowl/sync-to-copper', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to sync to Copper');
      }

      const data = await response.json();
      
      toast.success(`Synced ${data.stats.synced} customers to Copper!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncingToCopper(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Fishbowl Integration</h2>
        <p className="text-sm text-gray-600 mt-1">
          Import data, calculate metrics, sync to Copper, and manage sales attribution
        </p>
      </div>

      {/* STEP 1: Unified Import */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-lg">
            1
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-purple-900">Import Fishbowl Data</h3>
            <p className="text-sm text-purple-700">Upload Conversight export - Creates Customers, Orders, AND Line Items in one go!</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
            <p className="text-sm text-green-900 font-semibold mb-2">
              ✨ ONE UPLOAD = EVERYTHING!
            </p>
            <ul className="text-sm text-green-800 space-y-1">
              <li>✅ Creates/updates Customers (deduplicated by Customer ID)</li>
              <li>✅ Creates/updates Sales Orders (with Customer link)</li>
              <li>✅ Creates Line Items (with Product, Revenue, Cost data)</li>
              <li>✅ All properly linked together!</li>
              <li>✅ ~60K rows in 2-3 minutes</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📊 Conversight Export (Fishbowl_SalesOrder_export.csv)
            </label>
            <input
              ref={unifiedInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setUnifiedFile(e.target.files?.[0] || null)}
              disabled={unifiedLoading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 disabled:opacity-50"
            />
            {unifiedFile && (
              <p className="mt-2 text-sm text-green-600">
                ✅ Selected: {unifiedFile.name} ({(unifiedFile.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
          </div>

          <button
            onClick={handleUnifiedImport}
            disabled={unifiedLoading || !unifiedFile}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg flex items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5" />
            {unifiedLoading ? 'Importing...' : 'Import Fishbowl Data'}
          </button>
        </div>

        {unifiedResult && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-green-900 mb-3">
              ✅ Import Complete!
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Customers</p>
                <p className="text-xl font-bold text-blue-600">
                  {(unifiedResult.stats.customersCreated + unifiedResult.stats.customersUpdated).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {unifiedResult.stats.customersCreated} new, {unifiedResult.stats.customersUpdated} updated
                </p>
              </div>
              <div>
                <p className="text-gray-600">Sales Orders</p>
                <p className="text-xl font-bold text-green-600">
                  {(unifiedResult.stats.ordersCreated + unifiedResult.stats.ordersUpdated).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {unifiedResult.stats.ordersCreated} new, {unifiedResult.stats.ordersUpdated} updated
                </p>
              </div>
              <div>
                <p className="text-gray-600">Line Items</p>
                <p className="text-xl font-bold text-purple-600">
                  {unifiedResult.stats.itemsCreated.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Product-level data</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STEP 2 & 3: Calculate & Sync Metrics */}
      <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 border-2 border-indigo-300 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
            2
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-indigo-900">Calculate & Sync Metrics to Copper</h3>
            <p className="text-sm text-indigo-700">Calculate customer metrics from sales orders and push to Copper CRM</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={calculateMetrics}
            disabled={calculating}
            className="bg-indigo-600 text-white px-6 py-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${calculating ? 'animate-spin' : ''}`} />
            {calculating ? 'Calculating...' : 'Calculate Metrics'}
          </button>

          <button
            onClick={syncToCopper}
            disabled={syncingToCopper}
            className="bg-cyan-600 text-white px-6 py-4 rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg flex items-center justify-center gap-2"
          >
            <Database className={`w-5 h-5 ${syncingToCopper ? 'animate-pulse' : ''}`} />
            {syncingToCopper ? 'Syncing...' : 'Sync to Copper'}
          </button>
        </div>

        {metricsStats && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-900">
              ✅ Calculated metrics for <strong>{metricsStats.processed}</strong> customers
              ({metricsStats.updated} updated, {metricsStats.skipped} skipped)
            </p>
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Workflow:</strong> After importing data (Step 1), click "Calculate Metrics" to compute customer stats, then "Sync to Copper" to push them to CRM.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-300 my-6"></div>

      {/* User Mapping Section */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">User Mapping</h3>
            <p className="text-sm text-gray-600">Map Fishbowl salesman names to Firebase users</p>
          </div>
          <button
            onClick={saveMapping}
            disabled={loading}
            className="px-4 py-2 bg-kanva-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Mapping'}
          </button>
        </div>

        {fishbowlUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No Fishbowl salesmen found. Make sure Fishbowl data is imported.</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Reload Data
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {fishbowlUsers.map((salesman) => (
              <div key={salesman} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{salesman}</p>
                  <p className="text-xs text-gray-500">Fishbowl Salesman</p>
                </div>
                <div className="flex-1">
                  <select
                    value={userMapping[salesman] || ''}
                    onChange={(e) => setUserMapping({ ...userMapping, [salesman]: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-kanva-green"
                  >
                    <option value="">-- Select Firebase User --</option>
                    {firebaseUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync Section */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Sync Fishbowl Sales</h3>
        
        <div className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-kanva-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-kanva-green"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={setLast90Days}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm"
            >
              Last 90 Days
            </button>
          </div>

          {/* Sync Button */}
          <button
            onClick={syncSales}
            disabled={syncing || Object.keys(userMapping).length === 0}
            className="w-full px-6 py-3 bg-kanva-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium"
          >
            {syncing ? 'Syncing...' : 'Sync Fishbowl Sales'}
          </button>

          {Object.keys(userMapping).length === 0 && (
            <p className="text-sm text-orange-600 text-center">
              ⚠️ Please map Fishbowl users first before syncing
            </p>
          )}
        </div>

        {/* Results */}
        {syncResults && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-900 mb-2">✅ Sync Complete!</h4>
            <div className="space-y-1 text-sm text-green-800">
              <p>• Processed {syncResults.ordersProcessed} orders</p>
              <p>• Created {syncResults.metricsCreated} metrics</p>
              <p>• Date range: {new Date(syncResults.dateRange.start).toLocaleDateString()} - {new Date(syncResults.dateRange.end).toLocaleDateString()}</p>
            </div>
            
            {syncResults.results && syncResults.results.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-green-900">
                  View Details ({syncResults.results.length} entries)
                </summary>
                <div className="mt-2 max-h-64 overflow-y-auto space-y-1 text-xs">
                  {syncResults.results.map((r: any, i: number) => (
                    <div key={i} className="p-2 bg-white rounded border">
                      {r.date} | {r.type} | ${r.value.toLocaleString()}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ How Sales Attribution Works</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Fishbowl orders are automatically categorized by customer accountType</li>
          <li>• Wholesale customers → <code className="bg-blue-100 px-1 rounded">new_sales_wholesale</code></li>
          <li>• Distribution customers → <code className="bg-blue-100 px-1 rounded">new_sales_distribution</code></li>
          <li>• Retail customers are skipped (not tracked in goals)</li>
          <li>• Sales are grouped by day and summed</li>
          <li>• Running sync multiple times won't create duplicates</li>
        </ul>
      </div>

      {/* Advanced Tools */}
      <div className="border border-gray-300 rounded-lg">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-700">Advanced Tools</span>
            <span className="text-sm text-gray-500">(One-time setup & troubleshooting)</span>
          </div>
          {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {showAdvanced && (
          <div className="px-6 pb-6 space-y-4 border-t">
            <div className="pt-4 space-y-3">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Note:</strong> These tools are for initial setup or troubleshooting. You typically won't need them for regular operations.
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <a
                  href="/admin/tools/copper-fishbowl-match"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <h4 className="font-semibold text-gray-900">🔗 Match Fishbowl ↔ Copper</h4>
                  <p className="text-sm text-gray-600 mt-1">Link Fishbowl customers to Copper companies (run once initially)</p>
                </a>
                
                <a
                  href="/admin/tools/copper-import-all"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <h4 className="font-semibold text-gray-900">📥 Import Copper Data</h4>
                  <p className="text-sm text-gray-600 mt-1">Import all Copper companies (already done - 270K companies)</p>
                </a>
                
                <a
                  href="/admin/tools/copper-create-missing"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <h4 className="font-semibold text-gray-900">➕ Create Missing Companies</h4>
                  <p className="text-sm text-gray-600 mt-1">Create Copper companies for Fishbowl customers not in CRM</p>
                </a>
                
                <a
                  href="/admin/tools/fishbowl-import"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <h4 className="font-semibold text-gray-900">🔧 Legacy Import Tools</h4>
                  <p className="text-sm text-gray-600 mt-1">Separate file imports (use Unified Import above instead)</p>
                </a>

                <a
                  href="/sales-insights"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <h4 className="font-semibold text-gray-900">📊 Sales Insights Dashboard</h4>
                  <p className="text-sm text-gray-600 mt-1">Analyze new business and YTD sales by customer and sales rep</p>
                </a>

                <button
                  type="button"
                  onClick={rebuildSalesInsightsMetrics}
                  disabled={rebuildingInsights}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                >
                  <h4 className="font-semibold text-gray-900">🛠 Rebuild Sales Insights Metrics</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    One-time or occasional admin action to refresh precomputed metrics used by the Sales Insights dashboard.
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Processing Modal */}
      {showProcessingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
            <div className="text-center">
              <div className="mb-6">
                {processingProgress < 100 ? (
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
                ) : (
                  <div className="text-6xl mb-4">✅</div>
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {processingProgress < 100 ? 'Processing...' : 'Complete!'}
              </h3>
              
              <p className="text-gray-600 mb-6">{processingStatus}</p>
              
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-green-500 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
              
              <p className="text-sm font-semibold text-gray-700">{processingProgress}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
