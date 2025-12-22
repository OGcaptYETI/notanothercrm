'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Target, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

interface CustomerSummary {
  customerId: string;
  customerName: string;
  totalSales: number;
  totalSalesYTD: number;
  orderCount: number;
  orderCountYTD: number;
  sales_30d: number;
  sales_90d: number;
  sales_12m: number;
  orders_30d: number;
  orders_90d: number;
  orders_12m: number;
  avgOrderValue: number;
  salesPerson: string;
  salesPersonName: string;
  salesPersonRegion: string;
  region: string;
  regionColor: string;
  accountType: string;
  shippingState: string;
  shippingCity: string;
  lastOrderDate: string | null;
}

interface StateStats {
  count: number;
  sales: number;
  sales_30d: number;
  sales_90d: number;
  activeCustomers: number;
  growth: number;
}

interface RegionConfig {
  name: string;
  color: string;
  states: string[];
}

interface RegionStats {
  name: string;
  color: string;
  customerCount: number;
  totalSales: number;
  totalSalesYTD: number;
  avgOrderValue: number;
  orderCount: number;
  orderCountYTD: number;
  sales_30d: number;
  sales_90d: number;
  activeCustomers_30d: number;
  activeCustomers_90d: number;
  topCustomers: CustomerSummary[];
}

// State abbreviation to full name mapping
const STATE_NAMES: { [key: string]: string } = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

export default function RegionMap() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [regions, setRegions] = useState<RegionConfig[]>([]);
  const [regionStats, setRegionStats] = useState<{ [key: string]: RegionStats }>({});
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [stateStats, setStateStats] = useState<{ [key: string]: StateStats }>({});
  const [sortBy, setSortBy] = useState<'sales' | 'customers' | 'growth'>('sales');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  
  // Date filtering state
  const [dateFilterMode, setDateFilterMode] = useState<'all-time' | 'ytd' | '90d' | '30d' | 'custom'>('all-time');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const loadCustomers = useCallback(async () => {
    try {
      console.log('Loading regions from Firestore...');
      const regionsSnapshot = await getDocs(collection(db, 'regions'));
      const regionsData: RegionConfig[] = [];
      regionsSnapshot.forEach((doc) => {
        const data = doc.data();
        regionsData.push({
          name: data.name || '',
          color: data.color || '#808080',
          states: data.states || []
        });
      });
      console.log(`Loaded ${regionsData.length} regions`);
      setRegions(regionsData);

      console.log('Loading customer summaries...');
      const snapshot = await getDocs(collection(db, 'customer_sales_summary'));
      const customersData: CustomerSummary[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        customersData.push({
          customerId: data.customerId || doc.id,
          customerName: data.customerName || '',
          totalSales: data.totalSales || 0,
          totalSalesYTD: data.totalSalesYTD || 0,
          orderCount: data.orderCount || 0,
          orderCountYTD: data.orderCountYTD || 0,
          sales_30d: data.sales_30d || 0,
          sales_90d: data.sales_90d || 0,
          sales_12m: data.sales_12m || 0,
          orders_30d: data.orders_30d || 0,
          orders_90d: data.orders_90d || 0,
          orders_12m: data.orders_12m || 0,
          avgOrderValue: data.avgOrderValue || 0,
          salesPerson: data.salesPerson || '',
          salesPersonName: data.salesPersonName || '',
          salesPersonRegion: data.salesPersonRegion || '',
          region: data.region || '',
          regionColor: data.regionColor || '#808080',
          accountType: data.accountType || '',
          shippingState: normalizeState(data.shippingState || ''),
          shippingCity: data.shippingCity || '',
          lastOrderDate: data.lastOrderDate || null
        });
      });

      console.log(`Loaded ${customersData.length} customer summaries`);
      setCustomers(customersData);
      
      // Check last updated timestamp
      const timestamps = customersData
        .map(c => c.lastOrderDate)
        .filter(d => d !== null)
        .map(d => new Date(d!));
      
      if (timestamps.length > 0) {
        const mostRecent = new Date(Math.max(...timestamps.map(d => d.getTime())));
        setLastUpdated(mostRecent);
        
        // Check if data is stale (>24 hours old)
        const hoursSinceUpdate = (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60);
        setIsStale(hoursSinceUpdate > 24);
      }
      
      // Calculate state stats with growth metrics
      const stats: { [key: string]: StateStats } = {};
      customersData.forEach(c => {
        if (!stats[c.shippingState]) {
          stats[c.shippingState] = { 
            count: 0, 
            sales: 0, 
            sales_30d: 0, 
            sales_90d: 0, 
            activeCustomers: 0,
            growth: 0
          };
        }
        stats[c.shippingState].count++;
        stats[c.shippingState].sales += c.totalSales;
        stats[c.shippingState].sales_30d += c.sales_30d;
        stats[c.shippingState].sales_90d += c.sales_90d;
        if (c.orders_30d > 0) {
          stats[c.shippingState].activeCustomers++;
        }
      });

      // Calculate growth percentage for each state
      Object.keys(stats).forEach(state => {
        const avg90d = stats[state].sales_90d / 3; // Average per 30 days over 90 days
        if (avg90d > 0) {
          stats[state].growth = ((stats[state].sales_30d - avg90d) / avg90d) * 100;
        }
      });

      setStateStats(stats);

      // Calculate region stats - match customers to regions by state
      const regStats: { [key: string]: RegionStats } = {};
      regionsData.forEach((region: RegionConfig) => {
        // Match customers by state instead of region field
        const regionCustomers = customersData.filter(c => 
          region.states.includes(c.shippingState)
        );
        
        // Calculate total orders for avg order value
        const totalOrders = regionCustomers.reduce((sum, c) => sum + c.orderCount, 0);
        const totalRevenue = regionCustomers.reduce((sum, c) => sum + c.totalSales, 0);
        
        regStats[region.name] = {
          name: region.name,
          color: region.color,
          customerCount: regionCustomers.length,
          totalSales: totalRevenue,
          totalSalesYTD: regionCustomers.reduce((sum, c) => sum + c.totalSalesYTD, 0),
          avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          orderCount: totalOrders,
          orderCountYTD: regionCustomers.reduce((sum, c) => sum + c.orderCountYTD, 0),
          sales_30d: regionCustomers.reduce((sum, c) => sum + c.sales_30d, 0),
          sales_90d: regionCustomers.reduce((sum, c) => sum + c.sales_90d, 0),
          activeCustomers_30d: regionCustomers.filter(c => c.orders_30d > 0).length,
          activeCustomers_90d: regionCustomers.filter(c => c.orders_90d > 0).length,
          topCustomers: regionCustomers
            .sort((a, b) => b.totalSales - a.totalSales)
            .slice(0, 5)
        };
      });
      setRegionStats(regStats);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading customers:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast.loading('Refreshing customer summaries...', { id: 'refresh' });
    
    try {
      const response = await fetch('/api/migrate-customer-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`✅ Refreshed ${result.summariesCreated} customer summaries!`, { id: 'refresh' });
        // Reload data
        await loadCustomers();
        setIsStale(false);
      } else {
        toast.error('Failed to refresh: ' + result.error, { id: 'refresh' });
      }
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast.error('Failed to refresh customer data', { id: 'refresh' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const normalizeState = (state: string): string => {
    const normalized = state.trim().toUpperCase();
    // If it's already 2 letters, return it
    if (normalized.length === 2) return normalized;
    
    // Try to find by full name
    const entry = Object.entries(STATE_NAMES).find(
      ([_, name]) => name.toUpperCase() === normalized
    );
    return entry ? entry[0] : normalized.slice(0, 2);
  };

  const getRegionForState = (state: string): RegionConfig | undefined => {
    return regions.find((r: RegionConfig) => r.states.includes(state));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Image 
          src="/images/kanva_logo_rotate.gif" 
          alt="Loading..." 
          width={64}
          height={64}
          unoptimized
        />
      </div>
    );
  }

  // Apply date filtering to display metrics
  const getFilteredMetrics = () => {
    let filteredSales = 0;
    let filteredOrders = 0;
    let filteredCustomers = 0;
    
    switch (dateFilterMode) {
      case 'ytd':
        filteredSales = Object.values(regionStats).reduce((sum, r) => sum + r.totalSalesYTD, 0);
        filteredOrders = Object.values(regionStats).reduce((sum, r) => sum + r.orderCountYTD, 0);
        filteredCustomers = customers.length;
        break;
      case '30d':
        filteredSales = Object.values(regionStats).reduce((sum, r) => sum + r.sales_30d, 0);
        filteredOrders = customers.reduce((sum, c) => sum + c.orders_30d, 0);
        filteredCustomers = customers.filter(c => c.orders_30d > 0).length;
        break;
      case '90d':
        filteredSales = Object.values(regionStats).reduce((sum, r) => sum + r.sales_90d, 0);
        filteredOrders = customers.reduce((sum, c) => sum + c.orders_90d, 0);
        filteredCustomers = customers.filter(c => c.orders_90d > 0).length;
        break;
      case 'all-time':
      default:
        filteredSales = Object.values(regionStats).reduce((sum, r) => sum + r.totalSales, 0);
        filteredOrders = Object.values(regionStats).reduce((sum, r) => sum + r.orderCount, 0);
        filteredCustomers = customers.length;
    }
    
    return {
      totalSales: filteredSales,
      totalOrders: filteredOrders,
      totalCustomers: filteredCustomers,
      avgOrderValue: filteredOrders > 0 ? filteredSales / filteredOrders : 0
    };
  };
  
  const metrics = getFilteredMetrics();
  const totalSales = Object.values(regionStats).reduce((sum, r) => sum + r.totalSales, 0);
  const totalSalesYTD = Object.values(regionStats).reduce((sum, r) => sum + r.totalSalesYTD, 0);
  
  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Unknown';
    
    const now = Date.now();
    const diffMs = now - lastUpdated.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  };
  const totalCustomers = customers.length;
  const activeCustomers_30d = customers.filter(c => c.orders_30d > 0).length;

  return (
    <div className="space-y-6">
      {/* Data Freshness Banner */}
      {isStale && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-yellow-900">Data May Be Outdated</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Customer data was last updated {formatLastUpdated()}. Click refresh to sync with latest sales orders.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      )}
      
      {/* Header with Refresh and Date Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Regional Performance</h2>
          <p className="text-sm text-gray-600 mt-1">
            Last updated: {formatLastUpdated()}
            {!isStale && ' ✓'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Filter Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Time Period:</label>
            <select
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value as any)}
              className="input text-sm py-1.5 px-3"
            >
              <option value="all-time">All-Time</option>
              <option value="ytd">Year to Date</option>
              <option value="90d">Last 90 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn-secondary px-4 py-2 flex items-center gap-2"
            title="Refresh customer data from latest sales orders"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>
      
      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-blue-900">Total Revenue ({dateFilterMode === 'all-time' ? 'All-Time' : dateFilterMode === 'ytd' ? 'YTD' : dateFilterMode === '90d' ? '90 Days' : '30 Days'})</div>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-900">{formatCurrency(metrics.totalSales)}</div>
          {dateFilterMode === 'all-time' && (
            <div className="text-xs text-blue-700 mt-1">YTD: {formatCurrency(totalSalesYTD)}</div>
          )}
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-green-900">Total Customers</div>
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-900">{formatNumber(metrics.totalCustomers)}</div>
          <div className="text-xs text-green-700 mt-1">
            {activeCustomers_30d} active (30d)
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-purple-900">Active Regions</div>
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-purple-900">
            {Object.keys(regionStats).length}
          </div>
          <div className="text-xs text-purple-700 mt-1">{Object.keys(stateStats).length} states</div>
        </div>

        <div className="card bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-amber-900">Avg Order Value</div>
            <ShoppingCart className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-amber-900">
            {formatCurrency(metrics.avgOrderValue)}
          </div>
          <div className="text-xs text-amber-700 mt-1">Across all regions</div>
        </div>
      </div>

      {/* Region Performance Cards */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">📊 Region Performance</h3>
          
          {/* Sort Options for Regions */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <button
              onClick={() => setSortBy('sales')}
              className={`px-3 py-1 text-sm rounded ${
                sortBy === 'sales'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setSortBy('customers')}
              className={`px-3 py-1 text-sm rounded ${
                sortBy === 'customers'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Customers
            </button>
            <button
              onClick={() => setSortBy('growth')}
              className={`px-3 py-1 text-sm rounded ${
                sortBy === 'growth'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Growth
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(regionStats)
            .map(region => {
              // Get the appropriate sales value based on date filter
              let displaySales = region.totalSales;
              let displayOrders = region.orderCount;
              
              switch (dateFilterMode) {
                case 'ytd':
                  displaySales = region.totalSalesYTD;
                  displayOrders = region.orderCountYTD;
                  break;
                case '30d':
                  displaySales = region.sales_30d;
                  // For 30d/90d, we need to sum up order counts from customers
                  displayOrders = region.topCustomers.reduce((sum, c) => sum + c.orders_30d, 0);
                  break;
                case '90d':
                  displaySales = region.sales_90d;
                  displayOrders = region.topCustomers.reduce((sum, c) => sum + c.orders_90d, 0);
                  break;
              }
              
              // For 30d/90d, recalculate from all region customers, not just top 5
              if (dateFilterMode === '30d' || dateFilterMode === '90d') {
                const regionCustomers = customers.filter(c => 
                  regions.find(r => r.name === region.name)?.states.includes(c.shippingState)
                );
                displayOrders = regionCustomers.reduce((sum, c) => 
                  sum + (dateFilterMode === '30d' ? c.orders_30d : c.orders_90d), 0
                );
              }
              
              // Calculate avg order value based on filtered period
              const displayAvgOrderValue = displayOrders > 0 ? displaySales / displayOrders : 0;
              
              return {
                ...region,
                displaySales,
                displayOrders,
                displayAvgOrderValue,
                growth: region.sales_90d > 0 
                  ? ((region.sales_30d - (region.sales_90d / 3)) / (region.sales_90d / 3)) * 100 
                  : 0
              };
            })
            .sort((a, b) => {
              switch (sortBy) {
                case 'customers':
                  return b.customerCount - a.customerCount;
                case 'growth':
                  return b.growth - a.growth;
                case 'sales':
                default:
                  return b.displaySales - a.displaySales;
              }
            })
            .map(region => {
              const isGrowing = region.growth > 0;

              return (
                <button
                  key={region.name}
                  onClick={() => setSelectedRegion(selectedRegion === region.name ? null : region.name)}
                  className={`p-5 rounded-lg border-2 transition-all text-left ${
                    selectedRegion === region.name
                      ? 'border-gray-900 shadow-lg scale-105'
                      : 'border-gray-200 hover:border-gray-400 hover:shadow-md'
                  }`}
                  style={{ backgroundColor: `${region.color}08` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: region.color }}
                      />
                      <span className="font-bold text-gray-900">{region.name}</span>
                    </div>
                    {isGrowing ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(region.displaySales)}
                      </div>
                      <div className="text-xs text-gray-600">Total Revenue</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {region.customerCount}
                        </div>
                        <div className="text-xs text-gray-600">Customers</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {region.activeCustomers_30d}
                        </div>
                        <div className="text-xs text-gray-600">Active (30d)</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(region.sales_30d)}
                        </div>
                        <div className="text-xs text-gray-600">Last 30d</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(region.displayAvgOrderValue)}
                        </div>
                        <div className="text-xs text-gray-600">Avg Order</div>
                      </div>
                    </div>

                    {Math.abs(region.growth) > 0.1 && (
                      <div className={`text-xs font-medium ${isGrowing ? 'text-green-700' : 'text-red-700'}`}>
                        {isGrowing ? '↑' : '↓'} {Math.abs(region.growth).toFixed(1)}% vs 90d avg
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* State Distribution Heat Map */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            🗺️ Customer Distribution by State
            {selectedRegion && ` - ${selectedRegion} Region`}
          </h3>
          
          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <button
              onClick={() => setSortBy('sales')}
              className={`px-3 py-1 text-sm rounded ${
                sortBy === 'sales'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setSortBy('customers')}
              className={`px-3 py-1 text-sm rounded ${
                sortBy === 'customers'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Customers
            </button>
            <button
              onClick={() => setSortBy('growth')}
              className={`px-3 py-1 text-sm rounded ${
                sortBy === 'growth'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Growth
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-2 border-gray-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-semibold text-gray-900 mb-2">
                🔥 Heat Map Intensity (by {sortBy === 'sales' ? 'Revenue' : sortBy === 'growth' ? 'Growth' : 'Customers'})
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 rounded bg-gradient-to-r from-red-100 to-red-500 border border-red-600" />
                  <span className="text-xs font-medium text-gray-700">Top 20% - 🔥 HOT</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 rounded bg-gradient-to-r from-orange-100 to-orange-400 border border-orange-500" />
                  <span className="text-xs text-gray-600">Top 40%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 rounded bg-gradient-to-r from-yellow-100 to-yellow-400 border border-yellow-500" />
                  <span className="text-xs text-gray-600">Top 60%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 rounded bg-gradient-to-r from-blue-100 to-blue-300 border border-blue-400" />
                  <span className="text-xs text-gray-600">Top 80%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 rounded bg-gradient-to-r from-gray-50 to-gray-200 border border-gray-300" />
                  <span className="text-xs text-gray-600">Bottom 20% - ❄️ COLD</span>
                </div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-2">Growth Indicators</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-gray-600">Growing (vs 90d avg)</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-gray-600">Declining (vs 90d avg)</span>
                </div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-2">Active Accounts</div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-600">Customers with orders in last 30 days</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(stateStats)
            .filter(([state]) => {
              if (!selectedRegion) return true;
              const region = regions.find((r: RegionConfig) => r.name === selectedRegion);
              return region?.states.includes(state);
            })
            .sort((a, b) => {
              if (sortBy === 'sales') return b[1].sales - a[1].sales;
              if (sortBy === 'customers') return b[1].count - a[1].count;
              return b[1].growth - a[1].growth;
            })
            .map(([state, stats]) => {
              const region = regions.find((r: RegionConfig) => r.states.includes(state));
              if (!region) return null;

              // Calculate heat map intensity (0-1 scale) - DYNAMIC based on sort mode
              let metricValue = 0;
              let allMetrics: number[] = [];
              
              switch (sortBy) {
                case 'sales':
                  // Use filtered sales based on date mode
                  switch (dateFilterMode) {
                    case 'ytd':
                      metricValue = stats.sales; // YTD already calculated
                      allMetrics = Object.values(stateStats).map(s => s.sales);
                      break;
                    case '30d':
                      metricValue = stats.sales_30d;
                      allMetrics = Object.values(stateStats).map(s => s.sales_30d);
                      break;
                    case '90d':
                      metricValue = stats.sales_90d;
                      allMetrics = Object.values(stateStats).map(s => s.sales_90d);
                      break;
                    default: // all-time
                      metricValue = stats.sales;
                      allMetrics = Object.values(stateStats).map(s => s.sales);
                  }
                  break;
                  
                case 'growth':
                  // Use growth percentage - can be negative!
                  metricValue = stats.growth;
                  allMetrics = Object.values(stateStats).map(s => s.growth);
                  break;
                  
                case 'customers':
                  metricValue = stats.count;
                  allMetrics = Object.values(stateStats).map(s => s.count);
                  break;
              }
              
              // Calculate intensity based on percentile
              let intensity = 0;
              if (sortBy === 'growth') {
                // For growth, normalize around 0 (negative = cold, positive = hot)
                const maxGrowth = Math.max(...allMetrics);
                const minGrowth = Math.min(...allMetrics);
                const range = maxGrowth - minGrowth;
                if (range > 0) {
                  // Map growth to 0-1 scale where 0.5 is no growth
                  intensity = (metricValue - minGrowth) / range;
                }
              } else {
                // For revenue/customers, simple max normalization
                const maxValue = Math.max(...allMetrics);
                intensity = maxValue > 0 ? metricValue / maxValue : 0;
              }
              
              const isGrowing = stats.growth > 0;
              const hasSignificantChange = Math.abs(stats.growth) > 5;

              // Heat map color gradient - DYNAMIC based on what we're showing
              const getHeatMapColor = (intensity: number) => {
                if (sortBy === 'growth') {
                  // For growth: Cold (blue) = decline, Hot (red) = high growth
                  if (intensity > 0.8) return 'from-red-100 to-red-500'; // Highest growth - HOT 🔥
                  if (intensity > 0.65) return 'from-orange-100 to-orange-400'; // Strong growth
                  if (intensity > 0.35) return 'from-yellow-100 to-yellow-300'; // Moderate (around 0% growth)
                  if (intensity > 0.2) return 'from-blue-100 to-blue-300'; // Declining
                  return 'from-blue-200 to-blue-500'; // Strong decline - COLD ❄️
                } else {
                  // For revenue/customers: Hot = high, Cold = low
                  if (intensity > 0.8) return 'from-red-100 to-red-500'; // Top 20% - HOT 🔥
                  if (intensity > 0.6) return 'from-orange-100 to-orange-400'; // Top 40%
                  if (intensity > 0.4) return 'from-yellow-100 to-yellow-400'; // Top 60%
                  if (intensity > 0.2) return 'from-blue-100 to-blue-300'; // Top 80%
                  return 'from-gray-50 to-gray-200'; // Bottom 20% - COLD ❄️
                }
              };

              const getTextColor = (intensity: number) => {
                if (intensity > 0.6) return 'text-white';
                return 'text-gray-900';
              };

              return (
                <div
                  key={state}
                  className={`p-3 rounded-lg border-2 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden bg-gradient-to-br ${getHeatMapColor(intensity)}`}
                  style={{ 
                    borderColor: intensity > 0.6 ? '#DC2626' : region.color,
                    borderWidth: intensity > 0.7 ? '3px' : '2px'
                  }}
                >
                  {/* Growth Indicator Badge */}
                  {hasSignificantChange && (
                    <div className={`absolute top-1 right-1 ${
                      isGrowing ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isGrowing ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold text-lg ${getTextColor(intensity)}`}>{state}</span>
                    <div
                      className="w-3 h-3 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: region.color }}
                    />
                  </div>
                  
                  <div className={`text-2xl font-bold mb-1 ${getTextColor(intensity)}`}>
                    {stats.count}
                  </div>
                  
                  <div className={`text-xs mb-2 ${intensity > 0.6 ? 'text-white/90' : 'text-gray-600'}`}>
                    {STATE_NAMES[state]}
                  </div>
                  
                  <div className={`space-y-1 pt-2 ${intensity > 0.6 ? 'border-white/30' : 'border-gray-200'} border-t`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={intensity > 0.6 ? 'text-white/90' : 'text-gray-600'}>Revenue:</span>
                      <span className={`font-semibold ${getTextColor(intensity)}`}>
                        {formatCurrency(stats.sales)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className={`flex items-center gap-1 ${intensity > 0.6 ? 'text-white/90' : 'text-gray-600'}`}>
                        <Users className="w-3 h-3" />
                        Active:
                      </span>
                      <span className={`font-semibold ${intensity > 0.6 ? 'text-white' : 'text-blue-700'}`}>
                        {stats.activeCustomers}
                      </span>
                    </div>
                    
                    {hasSignificantChange && (
                      <div className={`flex items-center justify-between text-xs font-semibold ${
                        intensity > 0.6 
                          ? 'text-white' 
                          : isGrowing ? 'text-green-700' : 'text-red-700'
                      }`}>
                        <span>Growth:</span>
                        <span>{isGrowing ? '↑' : '↓'} {Math.abs(stats.growth).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Top Customers by Region */}
      {selectedRegion && regionStats[selectedRegion] && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🏆 Top 5 Customers - {selectedRegion} Region
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Last 30d</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Orders</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Rep</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {regionStats[selectedRegion].topCustomers.map((customer, index) => (
                  <tr key={customer.customerId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">#{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.customerName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {customer.shippingCity}, {customer.shippingState}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-green-700">
                      {formatCurrency(customer.totalSales)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {formatCurrency(customer.sales_30d)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {customer.orderCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{customer.salesPersonName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
