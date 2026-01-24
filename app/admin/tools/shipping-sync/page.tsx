'use client';

import { useState } from 'react';
import { Truck, Calendar, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShippingSyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [ordersProcessed, setOrdersProcessed] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus('running');
    setSyncMessage('Initializing sync...');
    setOrdersProcessed(0);
    setTotalOrders(0);
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 500);

      setSyncMessage('Fetching orders from ShipStation...');
      
      const response = await fetch('/api/shipstation/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: dateRange.start,
          endDate: dateRange.end
        })
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sync failed');
      }

      const result = await response.json();
      
      setProgress(100);
      setSyncStatus('success');
      setSyncMessage(`Successfully synced ${result.ordersProcessed || 0} orders`);
      setOrdersProcessed(result.ordersProcessed || 0);
      setTotalOrders(result.ordersProcessed || 0);
      toast.success('Shipping data synced successfully!');
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      setSyncMessage(error.message || 'Failed to sync shipping data');
      toast.error('Sync failed: ' + error.message);
      setProgress(0);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-green-100 rounded-lg">
            <Truck className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shipping Sync - Historical Data</h1>
            <p className="text-gray-600">Manual sync for historical orders (up to 90 days)</p>
            <p className="text-sm text-blue-600 mt-1">
              ℹ️ Automated syncs run every 30 minutes for the last 14 days
            </p>
          </div>
        </div>
      </div>

      {/* Sync Configuration */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sync Configuration</h2>
        
        <div className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent"
                  disabled={syncing}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#93D500] focus:border-transparent"
                  disabled={syncing}
                />
              </div>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDateRange({
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              })}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={syncing}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateRange({
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              })}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={syncing}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDateRange({
                start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              })}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={syncing}
            >
              Last 90 Days
            </button>
          </div>

          {/* Sync Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Start Sync
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus !== 'idle' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sync Status</h2>
          
          <div className="space-y-3">
            {syncStatus === 'running' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900">Sync in progress...</p>
                    <p className="text-sm text-blue-700">{syncMessage}</p>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-[#93D500] transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {ordersProcessed > 0 && (
                    <p className="text-xs text-gray-500 text-center">
                      Processed {ordersProcessed} orders
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {syncStatus === 'success' && (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Sync completed successfully!</p>
                  <p className="text-sm text-green-700">{syncMessage}</p>
                  {ordersProcessed > 0 && (
                    <p className="text-sm text-green-700 mt-1">
                      Processed {ordersProcessed} orders
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {syncStatus === 'error' && (
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Sync failed</p>
                  <p className="text-sm text-red-700">{syncMessage}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Information */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">How it works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Fetches orders from ShipStation for the selected date range</li>
          <li>• Retrieves shipment and tracking information</li>
          <li>• Stores data in Firestore for fast access</li>
          <li>• Links orders to customer accounts automatically</li>
          <li>• Data is cached for 15 days by default</li>
        </ul>
      </div>
    </div>
  );
}
