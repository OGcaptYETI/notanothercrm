'use client';

import { useState, useEffect } from 'react';
import { Edit3, Save, X, AlertCircle, CheckCircle, Search, Filter, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface SalesOrder {
  id: string;
  soNumber: string;
  customerName: string;
  salesPerson: string;
  postingDate: any; // Can be Firestore Timestamp or string
  totalPrice: number;
  accountType: string;
  excludeFromCommission?: boolean;
  commissionNote?: string;
  productDetails?: string;
  commissionAmount?: number;
  commissionRate?: number;
  customerSegment?: string;
  customerStatus?: string;
}

interface EditCommissionsTabProps {
  isAdmin: boolean;
}

export default function EditCommissionsTab({ isAdmin }: EditCommissionsTabProps) {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<SalesOrder[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedRep, setSelectedRep] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [availableReps, setAvailableReps] = useState<string[]>([]);

  // Initialize with current month/year
  useEffect(() => {
    const now = new Date();
    setSelectedMonth(String(now.getMonth() + 1).padStart(2, '0'));
    setSelectedYear(String(now.getFullYear()));
  }, []);

  // Load orders when month/year/rep changes
  useEffect(() => {
    if (selectedMonth && selectedYear) {
      loadOrders();
    }
  }, [selectedMonth, selectedYear, selectedRep]);

  // Filter orders based on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredOrders(orders);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = orders.filter(order => 
      order.soNumber.toLowerCase().includes(term) ||
      order.customerName.toLowerCase().includes(term) ||
      order.salesPerson.toLowerCase().includes(term)
    );
    setFilteredOrders(filtered);
  }, [searchTerm, orders]);

  async function loadOrders() {
    if (!selectedMonth || !selectedYear) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: selectedMonth,
        year: selectedYear,
        ...(selectedRep !== 'all' && { salesPerson: selectedRep })
      });

      const response = await fetch(`/api/commission-orders?${params}`);
      if (!response.ok) throw new Error('Failed to load orders');

      const data = await response.json();
      setOrders(data.orders || []);
      setFilteredOrders(data.orders || []);
      
      // Extract unique sales reps
      const reps = Array.from(new Set(data.orders.map((o: SalesOrder) => o.salesPerson))).sort();
      setAvailableReps(reps as string[]);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleOrderExclusion(orderId: string, currentlyExcluded: boolean) {
    if (!isAdmin) {
      toast.error('Only admins can modify commission exclusions');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/toggle-commission-exclusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          exclude: !currentlyExcluded,
          month: selectedMonth,
          year: selectedYear
        })
      });

      if (!response.ok) throw new Error('Failed to update order');

      const data = await response.json();
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, excludeFromCommission: !currentlyExcluded }
          : order
      ));

      toast.success(
        !currentlyExcluded 
          ? 'Order excluded from commissions' 
          : 'Order included in commissions'
      );
    } catch (error) {
      console.error('Error toggling exclusion:', error);
      toast.error('Failed to update order');
    } finally {
      setSaving(false);
    }
  }

  async function saveNote(orderId: string) {
    if (!isAdmin) return;

    setSaving(true);
    try {
      const response = await fetch('/api/update-commission-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          note: noteText
        })
      });

      if (!response.ok) throw new Error('Failed to save note');

      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, commissionNote: noteText }
          : order
      ));

      setEditingNoteId(null);
      setNoteText('');
      toast.success('Note saved');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  }

  function startEditingNote(orderId: string, currentNote: string) {
    setEditingNoteId(orderId);
    setNoteText(currentNote || '');
  }

  function cancelEditingNote() {
    setEditingNoteId(null);
    setNoteText('');
  }

  const excludedCount = filteredOrders.filter(o => o.excludeFromCommission).length;
  const includedCount = filteredOrders.length - excludedCount;
  const excludedTotal = filteredOrders
    .filter(o => o.excludeFromCommission)
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const includedTotal = filteredOrders
    .filter(o => !o.excludeFromCommission)
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Commission Orders</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manually include or exclude orders from commission calculations
            </p>
          </div>
          <button
            onClick={loadOrders}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input w-full"
            >
              <option value="01">January</option>
              <option value="02">February</option>
              <option value="03">March</option>
              <option value="04">April</option>
              <option value="05">May</option>
              <option value="06">June</option>
              <option value="07">July</option>
              <option value="08">August</option>
              <option value="09">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="input w-full"
            >
              {[2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sales Rep
            </label>
            <select
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
              className="input w-full"
            >
              <option value="all">All Reps</option>
              {availableReps.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="SO#, Customer, Rep..."
                className="input w-full pl-10 text-sm placeholder:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div>
            <p className="text-sm text-gray-600">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
          </div>
          <div>
            <p className="text-sm text-green-600">Included</p>
            <p className="text-2xl font-bold text-green-600">{includedCount}</p>
            <p className="text-xs text-gray-500">${includedTotal.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-red-600">Excluded</p>
            <p className="text-2xl font-bold text-red-600">{excludedCount}</p>
            <p className="text-xs text-gray-500">${excludedTotal.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Commission Total</p>
            <p className="text-2xl font-bold text-primary-600">${includedTotal.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No orders found for selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Include
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SO Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sales Rep
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Segment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr 
                    key={order.id}
                    className={order.excludeFromCommission ? 'bg-red-50' : ''}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleOrderExclusion(order.id, order.excludeFromCommission || false)}
                        disabled={!isAdmin || saving}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          order.excludeFromCommission 
                            ? 'bg-red-600' 
                            : 'bg-green-600'
                        } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={order.excludeFromCommission ? 'Excluded from commissions' : 'Included in commissions'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            order.excludeFromCommission ? 'translate-x-1' : 'translate-x-6'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.soNumber}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {order.customerName}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.salesPerson}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.postingDate ? (() => {
                        try {
                          // Handle Firestore Timestamp or string date
                          let date: Date;
                          if (order.postingDate?.toDate) {
                            date = order.postingDate.toDate();
                          } else if (typeof order.postingDate === 'string') {
                            date = new Date(order.postingDate);
                          } else if (order.postingDate instanceof Date) {
                            date = order.postingDate;
                          } else {
                            return '-';
                          }
                          
                          // Validate the date is valid
                          if (isNaN(date.getTime())) {
                            return '-';
                          }
                          
                          return date.toLocaleDateString();
                        } catch {
                          return '-';
                        }
                      })() : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${order.totalPrice?.toLocaleString() || '0'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.commissionRate ? `${order.commissionRate.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-primary-600">
                      ${order.commissionAmount?.toLocaleString() || '0'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        order.customerSegment === 'Wholesale' || order.accountType === 'Wholesale' ? 'bg-blue-100 text-blue-800' :
                        order.customerSegment === 'Distributor' || order.accountType === 'Distributor' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.customerSegment || order.accountType || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {editingNoteId === order.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="e.g., On terms - not paid"
                            className="input text-xs py-1 px-2 w-48"
                            autoFocus
                          />
                          <button
                            onClick={() => saveNote(order.id)}
                            disabled={saving}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEditingNote}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600 text-xs">
                            {order.commissionNote || 'No note'}
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => startEditingNote(order.id, order.commissionNote || '')}
                              className="text-gray-400 hover:text-primary-600"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      {!isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Admin Access Required</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Only administrators can modify commission order inclusions and exclusions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
