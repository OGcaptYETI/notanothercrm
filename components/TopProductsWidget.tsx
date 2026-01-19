'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useProducts } from '@/lib/hooks/useProducts';
import { ProductThumbnailSimple } from './ProductThumbnail';
import { TrendingUp, Package, Calendar } from 'lucide-react';

interface ProductPerformance {
  productNum: string;
  productName: string;
  imageUrl: string | null;
  totalRevenue: number;
  totalCommission: number;
  orderCount: number;
  quantity: number;
}

interface TopProductsWidgetProps {
  year: number;
  month?: number;
  limit?: number;
  sortBy?: 'commission' | 'revenue' | 'quantity';
  salesRep?: string; // Optional filter by sales rep
}

export function TopProductsWidget({ 
  year, 
  month, 
  limit = 10,
  sortBy = 'commission',
  salesRep
}: TopProductsWidgetProps) {
  const { products } = useProducts();
  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayPeriod, setDisplayPeriod] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number; label: string }>>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(''); // Format: 'YYYY-MM'
  const [availableReps, setAvailableReps] = useState<string[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>('all');
  
  // Cache for loaded months (key: 'YYYY-MM-repName', value: ProductPerformance[])
  const [cache, setCache] = useState<Map<string, ProductPerformance[]>>(new Map());

  useEffect(() => {
    loadAvailableMonths();
    loadAvailableReps();
  }, []);

  useEffect(() => {
    if (products.size > 0 && availableMonths.length > 0) {
      loadTopProducts();
    }
  }, [selectedPeriod, selectedRep, products, sortBy, availableMonths]);

  async function loadAvailableReps() {
    try {
      // Load all reps who have commission data (query without month filter)
      const allRepsQuery = query(
        collection(db, 'monthly_commissions'),
        orderBy('repName')
      );
      
      const repsSnap = await getDocs(allRepsQuery);
      const reps = new Set<string>();
      
      repsSnap.forEach(doc => {
        const data = doc.data();
        if (data.repName) {
          reps.add(data.repName);
        }
      });
      
      setAvailableReps(Array.from(reps).sort());
      console.log(`👥 Loaded ${reps.size} sales reps`);
    } catch (error) {
      console.error('Error loading available reps:', error);
      setAvailableReps([]);
    }
  }

  async function loadAvailableMonths() {
    try {
      // Query for all unique year/month combinations in commission data
      const summariesQuery = query(
        collection(db, 'monthly_commission_summary'),
        orderBy('year', 'desc'),
        orderBy('month', 'desc')
      );
      
      const summariesSnap = await getDocs(summariesQuery);
      
      const months: Array<{ year: number; month: number; label: string }> = [];
      const seen = new Set<string>();
      
      summariesSnap.forEach(doc => {
        const data = doc.data();
        
        // Handle month format: could be "YYYY-MM" or just "MM"
        let monthStr = String(data.month);
        let yearNum = data.year;
        let monthNum: number;
        
        if (monthStr.includes('-')) {
          // Format: "2025-11"
          const [y, m] = monthStr.split('-');
          yearNum = parseInt(y);
          monthNum = parseInt(m);
        } else {
          // Format: "11" or 11
          monthNum = parseInt(monthStr);
        }
        
        const key = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          months.push({
            year: yearNum,
            month: monthNum,
            label: `${new Date(yearNum, monthNum - 1).toLocaleString('default', { month: 'long' })} ${yearNum}`
          });
        }
      });
      
      // Sort by year and month descending
      months.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
      
      setAvailableMonths(months);
      
      // Auto-select most recent month
      if (months.length > 0 && !selectedPeriod) {
        const mostRecent = `${months[0].year}-${String(months[0].month).padStart(2, '0')}`;
        setSelectedPeriod(mostRecent);
      }
    } catch (error) {
      console.error('Error loading available months:', error);
      setAvailableMonths([]);
    }
  }

  async function loadTopProducts() {
    try {
      setLoading(true);
      
      if (!selectedPeriod || availableMonths.length === 0) {
        setDisplayPeriod('No data available');
        setTopProducts([]);
        setLoading(false);
        return;
      }
      
      // Check cache first (cache key includes rep filter)
      const cacheKey = `${selectedPeriod}-${selectedRep}`;
      if (cache.has(cacheKey)) {
        console.log(`⚡ Using cached data for ${cacheKey}`);
        const cached = cache.get(cacheKey)!;
        setTopProducts(cached);
        
        // Parse for display label
        const [yearStr, monthStr] = selectedPeriod.split('-');
        const targetYear = parseInt(yearStr);
        const targetMonth = parseInt(monthStr);
        const periodLabel = `${new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })} ${targetYear}`;
        setDisplayPeriod(periodLabel);
        setLoading(false);
        return;
      }
      
      console.log(`🔄 Loading fresh data for ${selectedPeriod}, rep: ${selectedRep}`);
      
      // Parse selected period (format: YYYY-MM)
      const [yearStr, monthStr] = selectedPeriod.split('-');
      const targetYear = parseInt(yearStr);
      const targetMonth = parseInt(monthStr);
      
      // Set display period with rep filter
      const periodLabel = `${new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })} ${targetYear}${selectedRep !== 'all' ? ` - ${selectedRep}` : ''}`;
      setDisplayPeriod(periodLabel);

      // Query commissioned orders for the period
      // monthly_commissions uses: commissionMonth (string "YYYY-MM" format)
      const monthPadded = String(targetMonth).padStart(2, '0');
      const monthYearFormat = `${targetYear}-${monthPadded}`;
      
      console.log(`🔍 Querying monthly_commissions for commissionMonth=${monthYearFormat}, rep=${selectedRep}`);
      
      // Build query with optional rep filter
      const constraints = [
        where('commissionMonth', '==', monthYearFormat)
      ];
      
      if (selectedRep !== 'all') {
        constraints.push(where('repName', '==', selectedRep));
      }
      
      const commissionsQuery = query(
        collection(db, 'monthly_commissions'),
        ...constraints
      );
      
      const commissionsSnap = await getDocs(commissionsQuery);
      
      console.log(`📊 Found ${commissionsSnap.size} commission records`);

      if (commissionsSnap.empty) {
        console.warn(`⚠️ No commission data found for ${periodLabel}`);
        setTopProducts([]);
        setLoading(false);
        return;
      }

      // Build map of orderNum -> actual commission
      const orderCommissions = new Map<string, number>();
      const orderNums = new Set<string>();
      
      commissionsSnap.forEach(doc => {
        const data = doc.data();
        if (data.orderNum) {
          orderNums.add(data.orderNum);
          // Store actual commission amount by order
          // Field name is 'commissionAmount' per calculate-monthly-commissions route.ts line 667
          const key = data.orderNum;
          const commission = Number(data.commissionAmount || 0);
          orderCommissions.set(key, commission);
          
          // Debug: log first commission record
          if (orderCommissions.size === 1) {
            console.log('📋 Sample commission record:', {
              orderNum: data.orderNum,
              rep: data.repName,
              commissionAmount: data.commissionAmount,
              revenue: data.orderRevenue,
              allFields: Object.keys(data)
            });
          }
        }
      });

      // Query line items - OPTIMIZED: Single batch query instead of N+1
      const productMap = new Map<string, ProductPerformance>();
      
      // Batch query all line items for all orders at once (max 30 orders per query due to Firestore 'in' limit)
      const orderNumsArray = Array.from(orderNums);
      const allItems: Array<any> = [];
      
      // Process in batches of 30 (Firestore 'in' operator limit)
      for (let i = 0; i < orderNumsArray.length; i += 30) {
        const batch = orderNumsArray.slice(i, i + 30);
        const itemsQuery = query(
          collection(db, 'fishbowl_soitems'),
          where('salesOrderNum', 'in', batch)
        );
        
        const itemsSnap = await getDocs(itemsQuery);
        itemsSnap.forEach(doc => allItems.push(doc.data()));
      }
      
      console.log(`📦 Loaded ${allItems.length} line items for ${orderNumsArray.length} orders`);
      
      // Group items by order and calculate order totals
      const orderItemsMap = new Map<string, Array<{productNum: string; revenue: number; quantity: number; productName: string}>>();
      const orderTotalsMap = new Map<string, number>();
      
      allItems.forEach(data => {
        const orderNum = data.salesOrderNum;
        if (!orderNum) return;
        
        const productName = (data.product || data.description || '').toLowerCase();
        
        // Skip shipping and CC processing
        if (productName.includes('shipping') || productName.includes('cc processing')) {
          return;
        }
        
        const revenue = Number(data.revenue) || 0;
        
        if (!orderItemsMap.has(orderNum)) {
          orderItemsMap.set(orderNum, []);
          orderTotalsMap.set(orderNum, 0);
        }
        
        orderItemsMap.get(orderNum)!.push({
          productNum: data.partNumber || data.productNum || 'Unknown',
          revenue,
          quantity: Number(data.quantity) || 0,
          productName: data.product || data.description || 'Unknown'
        });
        
        orderTotalsMap.set(orderNum, orderTotalsMap.get(orderNum)! + revenue);
      });
      
      // Calculate product performance with prorated commissions
      orderItemsMap.forEach((items, orderNum) => {
        const orderCommission = orderCommissions.get(orderNum) || 0;
        const orderTotalRevenue = orderTotalsMap.get(orderNum) || 0;
        
        items.forEach(item => {
          const productNum = item.productNum;
          
          if (!productMap.has(productNum)) {
            const product = products.get(productNum);
            productMap.set(productNum, {
              productNum,
              productName: item.productName,
              imageUrl: product?.imageUrl || null,
              totalRevenue: 0,
              totalCommission: 0,
              orderCount: 0,
              quantity: 0,
            });
          }

          const entry = productMap.get(productNum)!;
          entry.totalRevenue += item.revenue;
          entry.quantity += item.quantity;
          entry.orderCount += 1;
          
          // Prorate commission based on product's share of order revenue
          if (orderTotalRevenue > 0) {
            const productCommission = (item.revenue / orderTotalRevenue) * orderCommission;
            entry.totalCommission += productCommission;
          }
        });
      });

      // Sort by selected metric
      const sortFn = {
        commission: (a: ProductPerformance, b: ProductPerformance) => b.totalCommission - a.totalCommission,
        revenue: (a: ProductPerformance, b: ProductPerformance) => b.totalRevenue - a.totalRevenue,
        quantity: (a: ProductPerformance, b: ProductPerformance) => b.quantity - a.quantity,
      };

      const sorted = Array.from(productMap.values())
        .sort(sortFn[sortBy])
        .slice(0, limit);

      // Store in cache for future use (cache key includes rep filter)
      setCache(prev => new Map(prev).set(cacheKey, sorted));
      console.log(`💾 Cached data for ${cacheKey} (${sorted.length} products)`);
      
      setTopProducts(sorted);
    } catch (error) {
      console.error('Error loading top products:', error);
      setTopProducts([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold text-gray-900">
            Top {limit} Products
          </h2>
        </div>
        
        {/* Filters: Month and Sales Rep */}
        <div className="flex items-center gap-3">
          {/* Sales Rep Filter */}
          <select
            value={selectedRep}
            onChange={(e) => setSelectedRep(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-colors"
            disabled={availableReps.length === 0}
          >
            <option value="all">All Reps</option>
            {availableReps.map(rep => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
          
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-colors"
              disabled={availableMonths.length === 0}
            >
              {availableMonths.length === 0 ? (
                <option>No data available</option>
              ) : (
                availableMonths.map(({ year, month, label }) => (
                  <option key={`${year}-${month}`} value={`${year}-${String(month).padStart(2, '0')}`}>
                    {label}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Show empty state if no products, otherwise show product list */}
      {topProducts.length === 0 ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No commission data available</p>
          <p className="text-sm text-gray-500 mt-2">
            {displayPeriod || 'Select a different period or sales rep to view data'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
        {topProducts.map((product, index) => (
          <div
            key={product.productNum}
            className="flex items-center gap-4 p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg hover:from-blue-50 hover:to-white transition-all border border-gray-200 hover:border-blue-300 hover:shadow-md"
          >
            {/* Rank Badge */}
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0
              ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-yellow-900 shadow-md' : ''}
              ${index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700 shadow-md' : ''}
              ${index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-900 shadow-md' : ''}
              ${index > 2 ? 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700' : ''}
            `}>
              {index + 1}
            </div>

            {/* Product Image */}
            <ProductThumbnailSimple
              imageUrl={product.imageUrl}
              productName={product.productName}
              size="md"
            />

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{product.productNum}</p>
              <p className="text-sm text-gray-600 truncate">{product.productName}</p>
            </div>

            {/* Stats */}
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-bold text-green-600">
                ${product.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">
                {product.quantity.toLocaleString()} units
              </p>
              <p className="text-xs text-gray-400">
                {product.orderCount} orders
              </p>
            </div>
          </div>
        ))}
      </div>

          {/* Summary Stats */}
          <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total Commission</p>
              <p className="text-lg font-bold text-green-600">
                ${topProducts.reduce((sum, p) => sum + p.totalCommission, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Total Units</p>
              <p className="text-lg font-bold text-blue-600">
                {topProducts.reduce((sum, p) => sum + p.quantity, 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Total Revenue</p>
              <p className="text-lg font-bold text-purple-600">
                ${topProducts.reduce((sum, p) => sum + p.totalRevenue, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
