'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import SAIAShippingDashboard from '@/components/shipping/saia/SAIAShippingDashboard';
import { ColumnDef } from '@tanstack/react-table';
import { ShipmentsDataTable } from '@/components/shipments/ShipmentsDataTable';
import { OrderDetailModal } from '@/components/shipments/OrderDetailModal';
import { 
  Package, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  ExternalLink,
  Truck,
  CheckCircle,
  Clock,
  Tag,
  AlertCircle,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { triggerSync, getSyncMeta } from '@/lib/services/shipstation';
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
  const [loading, setLoading] = useState(false);
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
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Order detail modal
  const [orderModalState, setOrderModalState] = useState<{
    isOpen: boolean;
    orderNumber: string;
  }>({ isOpen: false, orderNumber: '' });

  // Load sync metadata and auto-fetch on mount
  useEffect(() => {
    getSyncMeta().then(setSyncMeta).catch(console.error);
    fetchOrdersInitial();
  }, []);

  // Initial fetch
  const fetchOrdersInitial = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const start = new Date(sevenDaysAgo.setHours(0, 0, 0, 0));
      const end = new Date(today.setHours(23, 59, 59, 999));

      setStatusMessage('Loading orders from cache...');
      
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
      setStatusMessage(`Loaded ${result.orders.length} of ${result.total} orders`);
    } catch (error) {
      console.error('Failed to auto-fetch orders:', error);
      setStatusMessage('Click Fetch to load orders');
    } finally {
      setLoading(false);
    }
  };

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
    if (loading || loadingMore) return;

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

      setStatusMessage(append ? 'Loading more...' : 'Loading orders from cache...');
      
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
      setStatusMessage(`Loaded ${append ? orders.length + result.orders.length : result.orders.length} of ${result.total} orders`);
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
      const meta = await getSyncMeta();
      setSyncMeta(meta);
      await fetchOrders(1);
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const toggleRow = useCallback((orderId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  }, []);

  // Apply filters
  const filteredOrders = useMemo(() => {
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

    return filtered;
  }, [orders, sourceFilter, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const delivered = filteredOrders.filter(o => getDisplayStatus(o) === 'delivered').length;
    const inTransit = filteredOrders.filter(o => getDisplayStatus(o) === 'in_transit').length;
    const labelPurchased = filteredOrders.filter(o => {
      const status = getDisplayStatus(o);
      return status === 'label_purchased' || status === 'label_created';
    }).length;
    
    return { total, delivered, inTransit, labelPurchased };
  }, [filteredOrders]);

  // Define table columns
  const columns = useMemo<ColumnDef<ShipStationOrder, any>[]>(
    () => [
      {
        id: 'expand',
        header: '',
        cell: ({ row }) => {
          const isExpanded = expandedRows.has(row.original.orderId);
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleRow(row.original.orderId);
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
          );
        },
        size: 40,
        enableSorting: false,
      },
      {
        id: 'orderNumber',
        accessorKey: 'orderNumber',
        header: 'Order #',
        cell: ({ getValue, row }) => (
          <a
            href={`/orders/${getValue()}`}
            onClick={(e) => {
              // Only prevent default if left-click (not middle/right-click)
              if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                setOrderModalState({ isOpen: true, orderNumber: getValue() as string });
              }
            }}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {getValue() as string}
          </a>
        ),
      },
      {
        id: 'orderDate',
        accessorKey: 'orderDate',
        header: 'Date',
        cell: ({ getValue }) => {
          const date = getValue();
          return date ? new Date(date as any).toLocaleDateString() : '—';
        },
      },
      {
        id: 'customer',
        accessorFn: (row) => row.billTo?.name || row.shipTo?.name || '',
        header: 'Customer',
        cell: ({ row }) => {
          const name = row.original.billTo?.name || row.original.shipTo?.name;
          const customerId = row.original._customerId;
          
          return name ? (
            customerId ? (
              <a
                href={`/accounts/${customerId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-gray-900 hover:text-blue-600 hover:underline"
              >
                {name}
              </a>
            ) : (
              <span className="text-gray-900">{name}</span>
            )
          ) : (
            <span className="text-gray-400">—</span>
          );
        },
      },
      {
        id: 'shipTo',
        accessorFn: (row) => `${row.shipTo?.city || ''} ${row.shipTo?.state || ''}`.trim(),
        header: 'Ship To',
        cell: ({ row }) => {
          const city = row.original.shipTo?.city;
          const state = row.original.shipTo?.state;
          return city || state ? (
            <span className="text-gray-600 text-xs">
              {city && `${city}, `}{state}
            </span>
          ) : <span className="text-gray-400">—</span>;
        },
      },
      {
        id: 'carrier',
        accessorFn: (row) => row.shipments?.[0]?.carrierCode || row.carrierCode || '',
        header: 'Carrier',
        cell: ({ getValue }) => {
          const carrier = getValue() as string;
          return carrier ? (
            <span className="text-gray-600 text-xs uppercase">{carrier}</span>
          ) : <span className="text-gray-400">—</span>;
        },
      },
      {
        id: 'tracking',
        accessorFn: (row) => row.shipments?.[0]?.trackingNumber || '',
        header: 'Tracking',
        cell: ({ row }) => {
          const shipment = row.original.shipments?.[0];
          const trackingUrl = shipment ? getTrackingUrl(shipment.carrierCode, shipment.trackingNumber) : '';
          
          return shipment?.trackingNumber ? (
            trackingUrl ? (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 font-mono"
              >
                {shipment.trackingNumber.substring(0, 12)}...
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-gray-600 text-xs font-mono">{shipment.trackingNumber}</span>
            )
          ) : <span className="text-gray-400">—</span>;
        },
      },
      {
        id: 'status',
        accessorFn: (row) => getDisplayStatus(row),
        header: 'Status',
        size: 140,
        minSize: 140,
        cell: ({ row }) => {
          const status = getDisplayStatus(row.original);
          const statusColor = STATUS_COLORS[status] || '#6c757d';
          const statusIcon = {
            'delivered': <CheckCircle className="w-3 h-3" />,
            'in_transit': <Truck className="w-3 h-3" />,
            'label_purchased': <Tag className="w-3 h-3" />,
            'label_created': <Tag className="w-3 h-3" />,
            'awaiting_shipment': <Clock className="w-3 h-3" />,
            'pending': <Clock className="w-3 h-3" />,
          }[status] || <AlertCircle className="w-3 h-3" />;

          return (
            <div 
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
              style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
            >
              {statusIcon}
              {status.replace(/_/g, ' ')}
            </div>
          );
        },
      },
      {
        id: 'total',
        accessorKey: 'orderTotal',
        header: 'Total',
        cell: ({ getValue }) => {
          const total = getValue() as number;
          return total ? (
            <span className="text-gray-900 font-medium">
              ${total.toFixed(2)}
            </span>
          ) : <span className="text-gray-400">—</span>;
        },
      },
    ],
    [expandedRows, toggleRow]
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Please sign in to view shipments.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track orders and shipments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchOrders(1)}
            disabled={loading}
            className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
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
          {/* Sync Status - Only show if error or in progress */}
          {syncMeta && syncMeta.status !== 'success' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <div className="text-xs text-yellow-800">
                <strong>Sync Status:</strong> {syncMeta.status === 'error' ? 'Last sync encountered an issue' : 'Sync in progress'}
                {syncMeta.lastRunAt && (
                  <> • Last attempt: {new Date((syncMeta.lastRunAt as any).seconds * 1000).toLocaleString()}</>
                )}
              </div>
            </div>
          )}

          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500">Total Orders</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500">Delivered</div>
              <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                {stats.delivered.toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500">In Transit</div>
              <div className="text-2xl font-bold text-blue-600 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                {stats.inTransit.toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500">Label Purchased</div>
              <div className="text-2xl font-bold text-orange-600 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                {stats.labelPurchased.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Date Range */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => fetchOrders(1)}
                  disabled={loading}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  Fetch
                </button>
              </div>

              <div className="h-6 w-px bg-gray-200" />

              {/* Source Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Source:</span>
                {(['all', 'shopify', 'reprally', 'fishbowl'] as SourceFilter[]).map((source) => (
                  <button
                    key={source}
                    onClick={() => setSourceFilter(source)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      sourceFilter === source
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {source === 'all' && 'All'}
                    {source === 'shopify' && 'Shopify'}
                    {source === 'reprally' && 'RepRally'}
                    {source === 'fishbowl' && 'Fishbowl'}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-gray-200" />

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Status:</span>
                {(['all', 'delivered', 'in_transit', 'label_purchased', 'awaiting'] as StatusFilter[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' && 'All'}
                    {status === 'delivered' && 'Delivered'}
                    {status === 'in_transit' && 'In Transit'}
                    {status === 'label_purchased' && 'Label'}
                    {status === 'awaiting' && 'Awaiting'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Data Table */}
          <ShipmentsDataTable
            data={filteredOrders}
            columns={columns}
            loading={loading}
            searchPlaceholder="Search orders by number, customer, email, tracking..."
            globalFilter={searchQuery}
            onGlobalFilterChange={setSearchQuery}
            totalItems={totalOrders}
            pageSize={100000}
            expandedRows={expandedRows}
            getRowId={(order) => order.orderId}
            onLoadMore={() => fetchOrders(currentPage + 1, true)}
            hasMore={currentPage < totalPages}
            loadingMore={loadingMore}
            renderExpandedRow={(order) => (
              <div className="p-6 bg-gray-50">
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
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
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
                              <td colSpan={4} className="px-2 py-2 text-center text-gray-500">No items</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          />

        </>
      )}

      {/* LTL Tab Content */}
      {activeTab === 'ltl' && <SAIAShippingDashboard />}
      
      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={orderModalState.isOpen}
        onClose={() => setOrderModalState({ isOpen: false, orderNumber: '' })}
        orderNumber={orderModalState.orderNumber}
      />
    </div>
  );
}
