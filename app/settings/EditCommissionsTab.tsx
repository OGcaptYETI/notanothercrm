'use client';

import { useState, useEffect } from 'react';
import { Edit3, Save, X, AlertCircle, CheckCircle, Search, Filter, RefreshCw, Calendar } from 'lucide-react';
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
  rateModified?: boolean;
  rateComment?: string;
  originalRate?: number;
  customerSegment?: string;
  customerStatus?: string;
  movedFromMonth?: string;
  movedToMonth?: string;
  moveReason?: string;
  movedAt?: any;
  movedBy?: string;
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
  const [movingOrderId, setMovingOrderId] = useState<string | null>(null);
  const [moveToMonth, setMoveToMonth] = useState('');
  const [moveToYear, setMoveToYear] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState('');
  const [rateComment, setRateComment] = useState('');

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

  function startEditingRate(orderId: string, currentRate: number) {
    if (!isAdmin) {
      toast.error('Only admins can edit commission rates');
      return;
    }
    setEditingRateId(orderId);
    setRateValue(currentRate ? currentRate.toFixed(1) : '0.0');
    setRateComment('');
  }

  function cancelEditingRate() {
    setEditingRateId(null);
    setRateValue('');
    setRateComment('');
  }

  async function saveRate(orderId: string) {
    if (!isAdmin) return;

    const newRate = parseFloat(rateValue);
    if (isNaN(newRate) || newRate < 0 || newRate > 100) {
      toast.error('Please enter a valid rate between 0 and 100');
      return;
    }

    if (!rateComment.trim()) {
      toast.error('Please add a comment explaining the rate change');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/update-commission-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          newRate,
          comment: rateComment,
          month: selectedMonth,
          year: selectedYear
        })
      });

      if (!response.ok) throw new Error('Failed to update rate');

      const data = await response.json();
      
      // Update local state with new rate, commission amount, and rate modified flag
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { 
              ...order, 
              commissionRate: newRate,
              commissionAmount: data.newCommissionAmount,
              rateModified: true,
              rateComment: rateComment
            }
          : order
      ));

      setEditingRateId(null);
      setRateValue('');
      setRateComment('');
      toast.success(`Rate updated to ${newRate.toFixed(1)}% - Commission: $${data.newCommissionAmount.toLocaleString()}`);
    } catch (error) {
      console.error('Error updating rate:', error);
      toast.error('Failed to update rate');
    } finally {
      setSaving(false);
    }
  }

  function startMovingOrder(orderId: string) {
    if (!isAdmin) {
      toast.error('Only admins can move orders');
      return;
    }
    setMovingOrderId(orderId);
    // Default to next month
    const now = new Date();
    setMoveToMonth(String(now.getMonth() + 2).padStart(2, '0'));
    setMoveToYear(String(now.getFullYear()));
    setMoveReason('');
  }

  function cancelMovingOrder() {
    setMovingOrderId(null);
    setMoveToMonth('');
    setMoveToYear('');
    setMoveReason('');
  }

  async function moveOrder() {
    if (!movingOrderId || !moveToMonth || !moveToYear) return;

    setSaving(true);
    try {
      const response = await fetch('/api/move-commission-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: movingOrderId,
          fromMonth: selectedMonth,
          fromYear: selectedYear,
          toMonth: moveToMonth,
          toYear: moveToYear,
          reason: moveReason
        })
      });

      if (!response.ok) throw new Error('Failed to move order');

      const data = await response.json();
      
      toast.success(`Order moved to ${moveToYear}-${moveToMonth}`);
      
      // Reload orders to reflect the change
      await loadOrders();
      
      cancelMovingOrder();
    } catch (error) {
      console.error('Error moving order:', error);
      toast.error('Failed to move order');
    } finally {
      setSaving(false);
    }
  }

  const excludedCount = filteredOrders.filter(o => o.excludeFromCommission).length;
  const includedCount = filteredOrders.length - excludedCount;
  const excludedTotal = filteredOrders
    .filter(o => o.excludeFromCommission)
    .reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const includedTotal = filteredOrders
    .filter(o => !o.excludeFromCommission)
    .reduce((sum, o) => sum + (o.commissionAmount || 0), 0);

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
                      <div className="flex items-center gap-2">
                        <span>{order.soNumber}</span>
                        {order.movedFromMonth && (
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                            title={`Moved from ${order.movedFromMonth}${order.moveReason ? `: ${order.moveReason}` : ''}`}
                          >
                            📅 Moved
                          </span>
                        )}
                      </div>
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
                      {editingRateId === order.id ? (
                        <div className="flex flex-col space-y-2 min-w-[200px]">
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={rateValue}
                              onChange={(e) => setRateValue(e.target.value)}
                              step="0.1"
                              min="0"
                              max="100"
                              placeholder="0.0"
                              className="input text-sm py-2 px-3 w-20 font-semibold"
                              autoFocus
                            />
                            <span className="text-sm font-medium">%</span>
                          </div>
                          <input
                            type="text"
                            value={rateComment}
                            onChange={(e) => setRateComment(e.target.value)}
                            placeholder="Reason for rate change..."
                            className="input text-xs py-2 px-3 w-full"
                          />
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => saveRate(order.id)}
                              disabled={saving}
                              className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                              title="Save rate"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditingRate}
                              className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                              title="Cancel"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className={order.rateModified ? 'text-red-600 font-semibold' : ''}>
                            {order.commissionRate ? `${order.commissionRate.toFixed(1)}%` : '-'}
                          </span>
                          {order.rateModified && (
                            <span className="text-xs text-red-600" title={order.rateComment}>✏️</span>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => startEditingRate(order.id, order.commissionRate || 0)}
                              className="text-gray-400 hover:text-primary-600"
                              title="Edit rate"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
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
                            <>
                              <button
                                onClick={() => startEditingNote(order.id, order.commissionNote || '')}
                                className="text-gray-400 hover:text-primary-600"
                                title="Edit note"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => startMovingOrder(order.id)}
                                className="text-gray-400 hover:text-blue-600"
                                title="Move to different month"
                              >
                                <Calendar className="w-3 h-3" />
                              </button>
                            </>
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

      {/* Move Order Modal */}
      {movingOrderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                  Move Order to Different Month
                </h3>
                <button
                  onClick={cancelMovingOrder}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Number
                  </label>
                  <p className="text-sm text-gray-900 font-semibold">
                    {filteredOrders.find(o => o.id === movingOrderId)?.soNumber}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Month
                  </label>
                  <p className="text-sm text-gray-600">
                    {new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Move to Month
                    </label>
                    <select
                      value={moveToMonth}
                      onChange={(e) => setMoveToMonth(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Select Month</option>
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
                      value={moveToYear}
                      onChange={(e) => setMoveToYear(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Select Year</option>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                    placeholder="e.g., Awaiting payment, Terms customer"
                    className="input w-full"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Note:</strong> Moving this order will recalculate commissions for both the current month and the target month.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={cancelMovingOrder}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={moveOrder}
                  disabled={!moveToMonth || !moveToYear || saving}
                  className="btn-primary"
                >
                  {saving ? 'Moving...' : 'Move Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
