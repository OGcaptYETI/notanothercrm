'use client';

import { useState, useEffect } from 'react';
import { X, Search, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface ExcludedOrder {
  orderNum: string;
  customerName: string;
  customerId?: string;
  revenue: number;
  salesPerson: string;
}

interface CustomerSearchResult {
  id: string;
  name: string;
  accountType?: string;
  copperAccountOrderId?: string;
  aliases?: string[];
  matchScore: number;
}

interface ValidationData {
  excludedOrders: {
    retail: ExcludedOrder[];
    customerNotFound: ExcludedOrder[];
  };
  statistics: {
    totalOrders: number;
    matchedOrders: number;
    totalRevenue: string;
  };
}

interface CommissionValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  validationData: ValidationData | null;
  onProceed: () => void;
  onRevalidate: () => void;
}

export default function CommissionValidationModal({
  isOpen,
  onClose,
  validationData,
  onProceed,
  onRevalidate
}: CommissionValidationModalProps) {
  const [selectedOrder, setSelectedOrder] = useState<ExcludedOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [rememberCorrection, setRememberCorrection] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (selectedOrder && selectedOrder.customerName) {
      setSearchQuery(selectedOrder.customerName);
      handleSearch(selectedOrder.customerName);
    }
  }, [selectedOrder]);

  const handleSearch = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch('/api/search-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit: 5 })
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLinkCustomer = async (newCustomerId: string) => {
    if (!selectedOrder) return;

    setIsSaving(true);
    setSuccessMessage('');

    try {
      const response = await fetch('/api/fix-order-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: selectedOrder.orderNum,
          oldCustomerId: selectedOrder.customerId || '',
          newCustomerId: newCustomerId,
          rememberCorrection: rememberCorrection,
          reason: 'Manual correction via validation UI'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(`✅ Order ${selectedOrder.orderNum} linked to customer ${newCustomerId}`);
        
        // Clear selection after 2 seconds and revalidate
        setTimeout(() => {
          setSelectedOrder(null);
          setSearchQuery('');
          setSearchResults([]);
          setSuccessMessage('');
          onRevalidate();
        }, 2000);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Link customer error:', error);
      alert('Failed to link customer');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !validationData) return null;

  const allExcludedOrders = [
    ...validationData.excludedOrders.retail,
    ...validationData.excludedOrders.customerNotFound
  ];

  const hasErrors = allExcludedOrders.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Commission Calculation Validation</h2>
            <p className="text-sm text-blue-100">Review data quality before processing</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-blue-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-blue-600">{validationData.statistics.totalOrders}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Matched Orders</p>
              <p className="text-2xl font-bold text-green-600">{validationData.statistics.matchedOrders}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">${validationData.statistics.totalRevenue}</p>
            </div>
          </div>

          {/* Excluded Orders Section */}
          {hasErrors && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold text-yellow-900 text-lg mb-2">
                    {allExcludedOrders.length} Orders Excluded - Review & Fix
                  </h3>
                  <p className="text-sm text-yellow-800 mb-4">
                    These orders will not be included in commission calculations. Click on an order to fix it.
                  </p>

                  {/* Order List */}
                  <div className="space-y-2">
                    {allExcludedOrders.map((order) => (
                      <div
                        key={order.orderNum}
                        onClick={() => setSelectedOrder(order)}
                        className={`bg-white border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          selectedOrder?.orderNum === order.orderNum
                            ? 'border-blue-500 shadow-lg'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">Order {order.orderNum}</p>
                            <p className="text-sm text-gray-600">{order.customerName}</p>
                            {order.customerId && (
                              <p className="text-xs text-gray-500">Customer ID: {order.customerId}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">${order.revenue.toFixed(2)}</p>
                            <p className="text-sm text-gray-600">Rep: {order.salesPerson}</p>
                          </div>
                        </div>
                        {selectedOrder?.orderNum === order.orderNum && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-sm font-semibold text-gray-700 mb-3">Search for correct customer:</p>
                            
                            {/* Search Input */}
                            <div className="flex gap-2 mb-3">
                              <div className="flex-1 relative">
                                <input
                                  type="text"
                                  value={searchQuery}
                                  onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    handleSearch(e.target.value);
                                  }}
                                  placeholder="Search by customer name or ID..."
                                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <Search className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
                              </div>
                            </div>

                            {/* Search Results */}
                            {isSearching && (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                              </div>
                            )}

                            {!isSearching && searchResults.length > 0 && (
                              <div className="space-y-2 mb-4">
                                <p className="text-sm font-semibold text-gray-700">Suggested matches:</p>
                                {searchResults.map((result) => (
                                  <div
                                    key={result.id}
                                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex-1">
                                        <p className="font-semibold text-gray-900">{result.name}</p>
                                        <p className="text-xs text-gray-600">ID: {result.id}</p>
                                        {result.aliases && result.aliases.length > 0 && (
                                          <p className="text-xs text-gray-500">Aliases: {result.aliases.join(', ')}</p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                          result.accountType === 'Wholesale' ? 'bg-green-100 text-green-800' :
                                          result.accountType === 'Distributor' ? 'bg-blue-100 text-blue-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {result.accountType || 'Retail'}
                                        </span>
                                        <p className="text-xs text-gray-500 mt-1">{result.matchScore}% match</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleLinkCustomer(result.id)}
                                      disabled={isSaving}
                                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-semibold"
                                    >
                                      {isSaving ? 'Linking...' : 'Link to This Customer'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Remember Correction Checkbox */}
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={rememberCorrection}
                                onChange={(e) => setRememberCorrection(e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span>Remember this correction (add old ID as alias)</span>
                            </label>

                            {successMessage && (
                              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <p className="text-sm text-green-800">{successMessage}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!hasErrors && (
            <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-bold text-green-900">All orders validated successfully!</p>
                <p className="text-sm text-green-800">Ready to proceed with commission calculation.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={onRevalidate}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Re-Validate
            </button>
            <button
              onClick={onProceed}
              disabled={hasErrors}
              className={`px-6 py-2 rounded-lg font-medium ${
                hasErrors
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {hasErrors ? '⚠️ Errors must be resolved before proceeding' : 'Proceed with Calculation →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
