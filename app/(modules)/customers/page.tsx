'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Users,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/contexts/AuthContext';

const formatDate = (dateString: string) => {
  if (!dateString || dateString === 'N/A') return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch {
    return 'N/A';
  }
};

export default function ActiveCustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountType, setSelectedAccountType] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedState, setSelectedState] = useState('all');
  const [sortField, setSortField] = useState<'customerNum' | 'customerName' | 'accountType' | 'salesPerson' | 'shippingCity' | 'shippingState' | 'region' | 'orderCount' | 'lifetimeValue' | 'lastOrderDate'>('customerName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, [user]);

  const loadCustomers = async () => {
    if (!user) return;
    
    console.log('Loading customers for sales rep...');
    setLoading(true);
    
    try {
      // Load customer sales summary for metrics (includes salesPerson)
      const summarySnapshot = await getDocs(collection(db, 'customer_sales_summary'));
      const summaryMap = new Map();
      summarySnapshot.forEach((doc) => {
        const data = doc.data();
        summaryMap.set(doc.id, {
          orderCount: data.orderCount || 0,
          totalSales: data.totalSales || 0,
          region: data.region || '',
          regionColor: data.regionColor || '#808080',
          salesPerson: data.salesPerson || '', // Already has sales rep info
          lastOrderDate: data.lastOrderDate || '' // Last order date
        });
      });
      console.log(`Loaded ${summaryMap.size} customer sales summaries`);

      // Get customers from Firestore
      const snapshot = await getDocs(collection(db, 'fishbowl_customers'));
      console.log(`Found ${snapshot.size} customers in Firestore`);

      const customersData: any[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const customerId = data.id || data.customerNum || doc.id;

        // Get sales summary metrics
        const summary = summaryMap.get(customerId) || {
          orderCount: 0,
          totalSales: 0,
          region: '',
          regionColor: '#808080',
          lastOrderDate: ''
        };

        // Get current owner from customer data or summary
        const currentOwner = data.fishbowlUsername || data.currentOwner || data.salesRep || summary.salesPerson || '';
        
        // Get the original owner from summary (already aggregated from orders)
        const originalOwner = summary.salesPerson || data.salesRep || 'Unassigned';

        customersData.push({
          id: doc.id,
          customerNum: data.id || data.accountNumber?.toString() || doc.id,
          customerName: data.name || data.customerContact || 'Unknown',
          accountType: data.accountType || 'Retail',
          salesPerson: currentOwner || 'Unassigned',
          originalOwner: originalOwner,
          shippingCity: data.shippingCity || '',
          shippingState: data.shippingState || '',
          transferStatus: data.transferStatus,
          // Sales metrics from customer_sales_summary
          orderCount: summary.orderCount,
          lifetimeValue: summary.totalSales,
          lastOrderDate: summary.lastOrderDate,
          region: summary.region,
          regionColor: summary.regionColor
        });
      });

      // Sort by customer name
      customersData.sort((a, b) => a.customerName.localeCompare(b.customerName));

      console.log('Loaded customers:', customersData.length);
      setCustomers(customersData);
      setFilteredCustomers(customersData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
      setLoading(false);
    }
  };

  const handleSort = (field: 'customerNum' | 'customerName' | 'accountType' | 'salesPerson' | 'shippingCity' | 'shippingState' | 'region' | 'orderCount' | 'lifetimeValue' | 'lastOrderDate') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort customers
  useEffect(() => {
    let filtered = customers;

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customerNum.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedAccountType !== 'all') {
      filtered = filtered.filter(c => c.accountType === selectedAccountType);
    }

    if (selectedCity !== 'all') {
      filtered = filtered.filter(c => c.shippingCity === selectedCity);
    }

    if (selectedState !== 'all') {
      filtered = filtered.filter(c => c.shippingState === selectedState);
    }

    if (selectedRegion !== 'all') {
      filtered = filtered.filter(c => c.region === selectedRegion);
    }

    // Sort with proper numeric handling
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      // Handle numeric fields
      if (sortField === 'orderCount' || sortField === 'lifetimeValue') {
        const aNum = Number(aVal) || 0;
        const bNum = Number(bVal) || 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Handle string fields
      const aStr = (aVal || '').toString();
      const bStr = (bVal || '').toString();
      const comparison = aStr.localeCompare(bStr);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredCustomers(filtered);
  }, [searchTerm, selectedAccountType, selectedCity, selectedState, selectedRegion, customers, sortField, sortDirection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Loading customers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">👥 Active Customers</h2>
            <p className="text-sm text-gray-600 mt-1">
              View customer data and regional distribution
            </p>
          </div>
          <button
            onClick={loadCustomers}
            className="btn btn-secondary flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Regional Stats Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total Customers Card */}
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-900">Total Customers</h3>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-900">{customers.length}</p>
          <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-blue-700">
            <div className="flex justify-between">
              <span>Wholesale:</span>
              <span className="font-semibold">{customers.filter(c => c.accountType === 'Wholesale').length}</span>
            </div>
            <div className="flex justify-between">
              <span>Distributor:</span>
              <span className="font-semibold">{customers.filter(c => c.accountType === 'Distributor').length}</span>
            </div>
            <div className="flex justify-between">
              <span>Retail:</span>
              <span className="font-semibold">{customers.filter(c => c.accountType === 'Retail').length}</span>
            </div>
          </div>
        </div>

        {/* Regional Cards */}
        {Array.from(new Set(customers.map(c => c.region).filter(Boolean))).sort().map(region => {
          const regionCustomers = customers.filter(c => c.region === region);
          const regionColor = regionCustomers[0]?.regionColor || '#808080';
          const wholesale = regionCustomers.filter(c => c.accountType === 'Wholesale').length;
          const distributor = regionCustomers.filter(c => c.accountType === 'Distributor').length;
          const retail = regionCustomers.filter(c => c.accountType === 'Retail').length;
          const unassigned = regionCustomers.filter(c => !c.salesPerson || c.salesPerson === '' || c.salesPerson === 'Unassigned').length;
          
          return (
            <div key={region} className="card hover:shadow-lg transition-shadow cursor-pointer" 
                 onClick={() => setSelectedRegion(region)}
                 style={{ borderLeftWidth: '4px', borderLeftColor: regionColor }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">{region}</h3>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: regionColor }}></div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{regionCustomers.length}</p>
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Wholesale:</span>
                  <span className="font-semibold text-green-600">{wholesale}</span>
                </div>
                <div className="flex justify-between">
                  <span>Distributor:</span>
                  <span className="font-semibold text-green-600">{distributor}</span>
                </div>
                <div className="flex justify-between">
                  <span>Retail:</span>
                  <span className="font-semibold text-yellow-600">{retail}</span>
                </div>
                {unassigned > 0 && (
                  <div className="flex justify-between mt-1 pt-1 border-t border-gray-200">
                    <span className="text-orange-600">⚠ Unassigned:</span>
                    <span className="font-semibold text-orange-600">{unassigned}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Unassigned Region Card */}
        {customers.filter(c => !c.region).length > 0 && (
          <div className="card bg-gray-50 border-gray-300" 
               onClick={() => setSelectedRegion('')}
               style={{ borderLeftWidth: '4px', borderLeftColor: '#808080' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Unassigned</h3>
              <AlertCircle className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-3xl font-bold text-gray-700">{customers.filter(c => !c.region).length}</p>
            <div className="mt-2 pt-2 border-t border-gray-300 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Wholesale:</span>
                <span className="font-semibold">{customers.filter(c => !c.region && c.accountType === 'Wholesale').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Distributor:</span>
                <span className="font-semibold">{customers.filter(c => !c.region && c.accountType === 'Distributor').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Retail:</span>
                <span className="font-semibold">{customers.filter(c => !c.region && c.accountType === 'Retail').length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters and Export */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          <button
            onClick={() => {
              const csv = [
                [
                  'Customer #',
                  'Name',
                  'Sales Rep',
                  'Account Type',
                  'Transfer Status',
                  'City',
                  'State',
                  'Region',
                  'Orders',
                  'Last Order Date',
                  'Lifetime Value'
                ],
                ...filteredCustomers.map(c => [
                  c.customerNum || '',
                  c.customerName || '',
                  c.salesPerson || '',
                  c.accountType || '',
                  c.transferStatus || '',
                  c.shippingCity || '',
                  c.shippingState || '',
                  c.region || '',
                  c.orderCount || 0,
                  c.lastOrderDate || '',
                  c.lifetimeValue || 0
                ])
              ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `active_customers_${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              window.URL.revokeObjectURL(url);
              toast.success(`✅ Exported ${filteredCustomers.length} customers!`);
            }}
            className="btn btn-primary flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </button>
        </div>
        <div className="grid md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
            <input
              type="text"
              placeholder="Customer name or #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
            <select
              value={selectedAccountType}
              onChange={(e) => setSelectedAccountType(e.target.value)}
              className="input w-full"
            >
              <option value="all">All Types</option>
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
              <option value="Distributor">Distributor</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="input w-full"
            >
              <option value="all">All Regions</option>
              {Array.from(new Set(customers.map(c => c.region).filter(Boolean))).sort().map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
              <option value="">Unassigned</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="input w-full"
            >
              <option value="all">All Cities</option>
              {Array.from(new Set(customers.map(c => c.shippingCity).filter(Boolean))).sort().map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="input w-full"
            >
              <option value="all">All States</option>
              {Array.from(new Set(customers.map(c => c.shippingState).filter(Boolean))).sort().map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Customers ({filteredCustomers.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                    onClick={() => handleSort('customerNum')}
                  >
                    <span>Customer #</span>
                    {sortField === 'customerNum' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                    onClick={() => handleSort('customerName')}
                  >
                    <span>Customer Name</span>
                    {sortField === 'customerName' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                    onClick={() => handleSort('accountType')}
                  >
                    <span>Account Type</span>
                    {sortField === 'accountType' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                    onClick={() => handleSort('salesPerson')}
                  >
                    <span>Sales Rep</span>
                    {sortField === 'salesPerson' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transfer Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                    onClick={() => handleSort('shippingCity')}
                  >
                    <span>City</span>
                    {sortField === 'shippingCity' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                    onClick={() => handleSort('shippingState')}
                  >
                    <span>State</span>
                    {sortField === 'shippingState' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                    onClick={() => handleSort('region')}
                  >
                    <span>Region</span>
                    {sortField === 'region' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                    onClick={() => handleSort('orderCount')}
                  >
                    <span>Orders</span>
                    {sortField === 'orderCount' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                    onClick={() => handleSort('lastOrderDate')}
                  >
                    <span>Last Order</span>
                    {sortField === 'lastOrderDate' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                    onClick={() => handleSort('lifetimeValue')}
                  >
                    <span>Lifetime Value</span>
                    {sortField === 'lifetimeValue' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.customerNum}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{customer.customerName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        customer.accountType === 'Retail'
                          ? 'bg-yellow-100 text-yellow-800'
                          : customer.accountType === 'Wholesale'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {customer.accountType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{customer.salesPerson}</td>
                    <td className="px-4 py-3">
                      {customer.transferStatus ? (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          customer.transferStatus === 'own'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {customer.transferStatus === 'own' ? '👤 Own' : '🔄 Transferred'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Auto</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{customer.shippingCity}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{customer.shippingState}</td>
                    <td className="px-4 py-3">
                      {customer.region ? (
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: customer.regionColor }}
                          ></div>
                          <span className="text-sm font-medium text-gray-900">{customer.region}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right font-medium">
                      {customer.orderCount || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(customer.lastOrderDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                      ${(customer.lifetimeValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
