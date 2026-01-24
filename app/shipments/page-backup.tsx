'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import SAIAShippingDashboard from '@/components/shipping/saia/SAIAShippingDashboard';
import { 
  Package, 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  ExternalLink,
  Truck,
  CheckCircle,
  Clock,
  Tag,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { fetchEnrichedOrders, triggerSync, getSyncMeta } from '@/lib/services/shipstation';
import { 
  getTrackingUrl, 
  getOrderSource, 
  STATUS_COLORS,
  type ShipStationOrder,
  type SourceFilter,
  type StatusFilter,
  type ShipStationSyncMeta
} from '@/types/shipstation';
import toast from 'react-hot-toast';

export default function ShipmentsPage() {
  const { user } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'shipstation' | 'ltl'>('shipstation');
  
  // ShipStation state
  const [orders, setOrders] = useState<ShipStationOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ShipStationOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [syncMeta, setSyncMeta] = useState<ShipStationSyncMeta | null>(null);
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return sevenDaysAgo.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  
  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load sync metadata and auto-fetch today's orders on mount
  useEffect(() => {
    getSyncMeta().then(setSyncMeta).catch(console.error);
    // Auto-fetch orders for today on page load
    fetchOrdersInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial fetch (separate to avoid circular dependency with useCallback)
  const fetchOrdersInitial = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const start = new Date(sevenDaysAgo.setHours(0, 0, 0, 0));
      const end = new Date(today.setHours(23, 59, 59, 999));

      setStatusMessage('Loading orders from cache...');
      
      // Fetch from Firestore cache via API
      const response = await fetch(
        `/api/shipstation/cached-orders?start=${start.toISOString()}&end=${end.toISOString()}&page=1&pageSize=100`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch cached orders');
      }

      const result = await response.json();

      setOrders(result.orders);
      setCurrentPage(result.page);
      setTotalPages(result.pages);
      setTotalOrders(result.total);
      setStatusMessage(`Loaded ${result.orders.length} of ${result.total} orders from cache`);
    } catch (error) {
      console.error('Failed to auto-fetch orders:', error);
      setStatusMessage('Click Fetch to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = orders;

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(o => getOrderSource(o.orderNumber) === sourceFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => {
        const status = getDisplayStatus(o);
        switch (statusFilter) {
          case 'delivered':
            return status === 'delivered';
          case 'in_transit':
            return status === 'in_transit';
          case 'label_purchased':
            return status === 'label_purchased' || status === 'label_created';
          case 'awaiting':
            return status === 'awaiting_shipment' || status === 'pending' || !status;
          default:
            return true;
        }
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o => {
        return (
          o.orderNumber?.toLowerCase().includes(q) ||
          o.customerEmail?.toLowerCase().includes(q) ||
          o.billTo?.name?.toLowerCase().includes(q) ||
          o.shipTo?.name?.toLowerCase().includes(q) ||
          o.shipTo?.city?.toLowerCase().includes(q) ||
          o.shipments?.some(s => s.trackingNumber?.toLowerCase().includes(q))
        );
      });
    }

    setFilteredOrders(filtered);
  }, [orders, sourceFilter, statusFilter, searchQuery]);

  const getDisplayStatus = (order: ShipStationOrder): string => {
    if (order._displayStatus) return order._displayStatus;
    
    const shipment = order.shipments?.[0];
    if (shipment) {
      if (shipment.carrierStatus) return shipment.carrierStatus;
      if (shipment.shipmentStatus) return shipment.shipmentStatus;
      if (shipment.shipDate) {
        const daysSinceShip = (Date.now() - new Date(shipment.shipDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceShip < 1) return 'label_purchased';
        if (daysSinceShip < 7) return 'in_transit';
        return 'delivered';
      }
    }
    
    if (order._v2Status) return order._v2Status.status;
    return order.orderStatus || 'awaiting_shipment';
  };

  const fetchOrders = useCallback(async (page = 1, append = false) => {
    if (loadingMore || loading) return;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setOrders([]);
        setExpandedRows(new Set());
      }

      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);

      setStatusMessage('Loading orders from cache...');
      
      // Use Firestore cache instead of direct API calls
      const response = await fetch(
        `/api/shipstation/cached-orders?start=${start.toISOString()}&end=${end.toISOString()}&page=${page}&pageSize=100`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch cached orders');
      }

      const result = await response.json();

      if (append) {
        setOrders(prev => [...prev, ...result.orders]);
      } else {
        setOrders(result.orders);
      }

      setCurrentPage(result.page);
      setTotalPages(result.pages);
      setTotalOrders(result.total);
      setStatusMessage(`Loaded ${append ? orders.length + result.orders.length : result.orders.length} of ${result.total} orders from cache`);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error(`Failed to fetch orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatusMessage('Error loading orders');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [startDate, endDate, loading, loadingMore, orders.length]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await triggerSync();
      toast.success(result.message);
      // Refresh sync metadata
      const meta = await getSyncMeta();
      setSyncMeta(meta);
      // Auto-refresh orders after sync
      await fetchOrders(1);
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const toggleRow = (orderId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };


  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Please sign in to view shipments.</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'in_transit':
        return <Truck className="w-4 h-4" />;
      case 'label_purchased':
      case 'label_created':
        return <Tag className="w-4 h-4" />;
      case 'awaiting_shipment':
      case 'pending':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white grid place-items-center shadow-md">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
            <p className="text-sm text-gray-500">Track orders and shipments</p>
          </div>
        </div>
        
        {activeTab === 'shipstation' && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync to Cache'}
          </button>
        )}
        
        {activeTab === 'ltl' && (
          <div className="text-sm text-gray-500">
            Data synced from Firebase Realtime Database
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('shipstation')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'shipstation'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📦 ShipStation
        </button>
        <button
          onClick={() => setActiveTab('ltl')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'ltl'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🚚 LTL (SAIA)
        </button>
      </div>

      {/* ShipStation Tab Content */}
      {activeTab === 'shipstation' && (
        <>
          {/* Sync Status */}
          {syncMeta && (
            <div className="text-xs text-gray-500">
              Last sync: {syncMeta.lastRunAt ? new Date((syncMeta.lastRunAt as any).seconds * 1000).toLocaleString() : 'Never'} 
              {' '}• Status: <span className={syncMeta.status === 'success' ? 'text-green-600' : syncMeta.status === 'error' ? 'text-red-600' : 'text-yellow-600'}>{syncMeta.status}</span>
              {syncMeta.ordersProcessed > 0 && ` • ${syncMeta.ordersProcessed} orders cached`}
            </div>
          )}

          {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        {/* Date Range and Search */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Start:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">End:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => fetchOrders(1)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Fetch
          </button>

          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <span className="text-sm text-gray-500">{statusMessage}</span>
        </div>

        {/* Source and Status Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Source:</span>
          {(['all', 'shopify', 'reprally', 'fishbowl'] as SourceFilter[]).map((source) => (
            <button
              key={source}
              onClick={() => setSourceFilter(source)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sourceFilter === source
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {source === 'all' && 'All'}
              {source === 'shopify' && '🛒 Shopify'}
              {source === 'reprally' && '🤝 RepRally'}
              {source === 'fishbowl' && '🐟 Fishbowl'}
            </button>
          ))}

          <span className="ml-4 text-sm font-medium text-gray-700">Status:</span>
          {(['all', 'delivered', 'in_transit', 'label_purchased', 'awaiting'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' && 'All'}
              {status === 'delivered' && '✅ Delivered'}
              {status === 'in_transit' && '🚚 In Transit'}
              {status === 'label_purchased' && '🏷️ Label'}
              {status === 'awaiting' && '⏳ Awaiting'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredOrders.length} orders on this page
        {totalOrders > 0 && ` (${totalOrders} total across all pages)`}
      </div>

      {/* Orders Table */}
      <div 
        ref={scrollContainerRef}
        className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700 border-b">Order #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700 border-b">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700 border-b">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700 border-b">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700 border-b">Ship To</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700 border-b">Carrier</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700 border-b">Tracking</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700 border-b">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700 border-b">Total</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700 border-b">Items</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                  {loading ? 'Loading orders...' : 'No orders found for this date range.'}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const isExpanded = expandedRows.has(order.orderId);
                const displayStatus = getDisplayStatus(order);
                const statusColor = STATUS_COLORS[displayStatus] || '#6c757d';
                const shipment = order.shipments?.[0];
                const trackingUrl = shipment ? getTrackingUrl(shipment.carrierCode, shipment.trackingNumber) : '';
                const itemsCount = order.items?.reduce((a, it) => a + (it.quantity || 0), 0) || 0;

                return (
                  <React.Fragment key={order.orderId}>
                    {/* Main Row */}
                    <tr 
                      onClick={() => toggleRow(order.orderId)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <a
                            href={`/orders/${order.orderNumber}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {order.orderNumber}
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : ''}
                      </td>
                      <td className="px-4 py-3">
                        {order.billTo?.name || order.shipTo?.name ? (
                          <a
                            href={`/accounts/${order._customerId || ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!order._customerId) {
                                e.preventDefault();
                              }
                            }}
                            className={`text-gray-900 ${order._customerId ? 'hover:text-blue-600 hover:underline cursor-pointer' : 'cursor-default'}`}
                          >
                            {order.billTo?.name || order.shipTo?.name}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {order.customerEmail || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {order.shipTo ? `${order.shipTo.city || ''}, ${order.shipTo.state || ''}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {shipment?.carrierCode || order.carrierCode || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {shipment?.trackingNumber ? (
                          trackingUrl ? (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                            >
                              {shipment.trackingNumber.substring(0, 15)}...
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-600">{shipment.trackingNumber}</span>
                          )
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-white"
                          style={{ backgroundColor: statusColor }}
                        >
                          {getStatusIcon(displayStatus)}
                          {displayStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        ${(order.orderTotal || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {itemsCount}
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={10} className="px-4 py-4 border-b-2 border-gray-200">
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            {/* Ship To */}
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                              <h4 className="text-xs font-semibold text-gray-500 mb-2">📦 SHIP TO</h4>
                              <p className="font-medium">{order.shipTo?.name || '—'}</p>
                              <p className="text-sm text-gray-600">{order.shipTo?.street1}</p>
                              {order.shipTo?.street2 && <p className="text-sm text-gray-600">{order.shipTo.street2}</p>}
                              <p className="text-sm text-gray-600">
                                {order.shipTo?.city}, {order.shipTo?.state} {order.shipTo?.postalCode}
                              </p>
                              {order.shipTo?.phone && <p className="text-sm text-gray-500 mt-1">📞 {order.shipTo.phone}</p>}
                            </div>

                            {/* Bill To */}
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                              <h4 className="text-xs font-semibold text-gray-500 mb-2">💳 BILL TO</h4>
                              <p className="font-medium">{order.billTo?.name || '—'}</p>
                              <p className="text-sm text-gray-600">{order.billTo?.street1}</p>
                              {order.billTo?.street2 && <p className="text-sm text-gray-600">{order.billTo.street2}</p>}
                              <p className="text-sm text-gray-600">
                                {order.billTo?.city}, {order.billTo?.state} {order.billTo?.postalCode}
                              </p>
                              {order.customerEmail && <p className="text-sm text-gray-500 mt-1">✉️ {order.customerEmail}</p>}
                            </div>

                            {/* Order Totals */}
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                              <h4 className="text-xs font-semibold text-gray-500 mb-2">💰 ORDER TOTALS</h4>
                              <p className="text-sm">Subtotal: <strong>${(order.orderTotal || 0).toFixed(2)}</strong></p>
                              <p className="text-sm">Shipping: ${(order.shippingAmount || 0).toFixed(2)}</p>
                              <p className="text-sm">Tax: ${(order.taxAmount || 0).toFixed(2)}</p>
                              <p className="text-sm mt-2">Paid: <strong>${(order.amountPaid || 0).toFixed(2)}</strong></p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Shipments */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 mb-2">🚚 SHIPMENTS & TRACKING</h4>
                              {order.shipments && order.shipments.length > 0 ? (
                                <div className="space-y-2">
                                  {order.shipments.map((s, i) => {
                                    const sTrackUrl = getTrackingUrl(s.carrierCode, s.trackingNumber);
                                    return (
                                      <div key={i} className="bg-white p-3 rounded-lg border border-gray-200 text-sm">
                                        <strong>{s.carrierCode}</strong> {s.serviceCode} | 
                                        Tracking: {s.trackingNumber ? (
                                          sTrackUrl ? (
                                            <a href={sTrackUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                              {s.trackingNumber}
                                            </a>
                                          ) : s.trackingNumber
                                        ) : '—'} | 
                                        Ship Date: {s.shipDate || '—'}
                                        {s.carrierStatus && (
                                          <span className="ml-2 text-xs text-green-600">({s.carrierStatus})</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No shipments yet</p>
                              )}
                            </div>

                            {/* Items */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 mb-2">📋 ITEMS ({order.items?.length || 0})</h4>
                              <table className="w-full text-xs bg-white border border-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="text-left px-2 py-1">SKU</th>
                                    <th className="text-left px-2 py-1">Name</th>
                                    <th className="text-center px-2 py-1">Qty</th>
                                    <th className="text-right px-2 py-1">Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {order.items?.map((item, i) => (
                                    <tr key={i} className="border-t border-gray-100">
                                      <td className="px-2 py-1">{item.sku}</td>
                                      <td className="px-2 py-1">{item.name}</td>
                                      <td className="px-2 py-1 text-center">{item.quantity}</td>
                                      <td className="px-2 py-1 text-right">${(item.unitPrice || 0).toFixed(2)}</td>
                                    </tr>
                                  )) || (
                                    <tr>
                                      <td colSpan={4} className="px-2 py-2 text-gray-500">No items</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Notes */}
                          {(order.customerNotes || order.internalNotes) && (
                            <div className="mt-4 space-y-2">
                              {order.customerNotes && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                                  <strong>Customer Notes:</strong> {order.customerNotes}
                                </div>
                              )}
                              {order.internalNotes && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                                  <strong>Internal Notes:</strong> {order.internalNotes}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>

        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="text-center py-4 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2" />
            Loading more orders...
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} ({totalOrders} total orders)
            </div>
            
            <div className="flex items-center gap-2">
              {/* First Page */}
              <button
                onClick={() => fetchOrders(1)}
                disabled={currentPage === 1 || loading}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                First
              </button>
              
              {/* Previous Page */}
              <button
                onClick={() => fetchOrders(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              
              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => fetchOrders(pageNum)}
                      disabled={loading}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${
                        currentPage === pageNum
                          ? 'bg-[#93D500] text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              {/* Next Page */}
              <button
                onClick={() => fetchOrders(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
              
              {/* Last Page */}
              <button
                onClick={() => fetchOrders(totalPages)}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* LTL Tab Content */}
      {activeTab === 'ltl' && (
        <>
          {/* SAIA Dashboard - Using Firebase Realtime Database */}
          <SAIAShippingDashboard />
        </>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
