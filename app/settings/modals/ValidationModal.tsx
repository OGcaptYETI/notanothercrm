'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle, ArrowRight, RefreshCw, Search, Loader2 } from 'lucide-react';

interface ExcludedOrder {
  orderNum: string;
  customerName: string;
  customerId?: string;
  accountType?: string;
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

interface ValidationWarning {
  type: 'unmatchedRep' | 'missingCustomer' | 'inactiveRep' | 'missingRate' | 'dataQuality' | 'retailExcluded' | 'orphanedOrders' | 'customerNotFound';
  severity: 'error' | 'warning' | 'info';
  count: number;
  message: string;
  details?: string[];
  orderNumbers?: string[];
}

interface RepBreakdown {
  repName: string;
  repId: string;
  orderCount: number;
  estimatedRevenue: number;
  status: 'active' | 'inactive';
  warnings: string[];
}

interface FieldMapping {
  detected: Record<string, string[]>;
  suggested: Record<string, string>;
  conflicts: string[];
}

interface ValidationData {
  valid: boolean;
  excludedOrders?: {
    retail: ExcludedOrder[];
    customerNotFound: ExcludedOrder[];
  };
  statistics: {
    totalOrders: number;
    matchedOrders: number;
    unmatchedOrders: number;
    activeReps: number;
    totalRevenue: string;
  };
  fieldMapping: FieldMapping;
  warnings: ValidationWarning[];
  repBreakdown: RepBreakdown[];
}

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  month: string;
  year: number;
}

export default function ValidationModal({ isOpen, onClose, onProceed, month, year }: ValidationModalProps) {
  const [loading, setLoading] = useState(true);
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'warnings' | 'reps' | 'mapping'>('overview');
  
  // Customer correction state
  const [selectedOrder, setSelectedOrder] = useState<ExcludedOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [rememberCorrection, setRememberCorrection] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Pending correction (configured but not yet staged)
  const [pendingCorrection, setPendingCorrection] = useState<{
    orderNumber: string;
    oldCustomerId: string;
    newCustomerId: string;
    newCustomerName: string;
    newAccountType: string;
    rememberCorrection: boolean;
  } | null>(null);
  
  // Staged corrections (not saved to DB yet)
  const [stagedCorrections, setStagedCorrections] = useState<Map<string, {
    orderNumber: string;
    oldCustomerId: string;
    newCustomerId: string;
    newCustomerName: string;
    newAccountType: string;
    rememberCorrection: boolean;
  }>>(new Map());

  useEffect(() => {
    if (isOpen) {
      validateData();
    }
  }, [isOpen, month, year]);

  const validateData = async (applyStaged = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
      const response = await fetch('/api/validate-commission-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionMonth })
      });
      
      if (!response.ok) {
        throw new Error('Validation failed');
      }
      
      let data = await response.json();
      
      // Apply staged corrections client-side for preview
      if (applyStaged && stagedCorrections.size > 0) {
        data = applyClientSideCorrections(data);
      }
      
      setValidationData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to validate data');
    } finally {
      setLoading(false);
    }
  };

  const applyClientSideCorrections = (data: ValidationData, corrections?: Map<string, any>): ValidationData => {
    const correctionsToApply = corrections || stagedCorrections;
    if (!data.excludedOrders || correctionsToApply.size === 0) return data;

    // Create a map of order numbers that have been corrected
    const correctedOrderNums = new Set(Array.from(correctionsToApply.keys()));
    
    // Filter out corrected orders from excluded lists
    const updatedExcludedOrders = {
      retail: (data.excludedOrders.retail || []).filter(order => {
        const correction = correctionsToApply.get(order.orderNum);
        if (!correction) return true;
        
        // If corrected to non-retail, remove from retail list
        return correction.newAccountType === 'Retail';
      }),
      customerNotFound: (data.excludedOrders.customerNotFound || []).filter(order => 
        !correctedOrderNums.has(order.orderNum)
      )
    };

    // Calculate how many orders were fixed
    const originalExcludedCount = 
      (data.excludedOrders.retail?.length || 0) + 
      (data.excludedOrders.customerNotFound?.length || 0);
    const newExcludedCount = 
      updatedExcludedOrders.retail.length + 
      updatedExcludedOrders.customerNotFound.length;
    const fixedCount = originalExcludedCount - newExcludedCount;

    // Update statistics
    const updatedStatistics = {
      ...data.statistics,
      matchedOrders: data.statistics.matchedOrders + fixedCount,
      unmatchedOrders: data.statistics.unmatchedOrders - fixedCount
    };

    // Update warnings to remove fixed orders
    const updatedWarnings = data.warnings.map(warning => {
      if (warning.type === 'retailExcluded' || warning.type === 'customerNotFound') {
        const filteredOrderNumbers = (warning.orderNumbers || []).filter(
          orderNum => !correctedOrderNums.has(orderNum)
        );
        return {
          ...warning,
          count: filteredOrderNumbers.length,
          orderNumbers: filteredOrderNumbers
        };
      }
      return warning;
    }).filter(warning => warning.count > 0);

    // Check if all errors are resolved
    const hasErrors = updatedWarnings.some(w => w.severity === 'error') || 
                      newExcludedCount > 0;

    return {
      ...data,
      valid: !hasErrors,
      excludedOrders: updatedExcludedOrders,
      statistics: updatedStatistics,
      warnings: updatedWarnings
    };
  };

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

  const handleLinkCustomer = (newCustomerId: string, customerName: string, accountType: string) => {
    if (!selectedOrder) return;

    // Merge with existing pending correction to preserve previous selections
    setPendingCorrection(prev => {
      // If there's an existing pending correction for this order, merge with it
      if (prev && prev.orderNumber === selectedOrder.orderNum) {
        return {
          ...prev,
          newCustomerId: newCustomerId,
          newCustomerName: customerName,
          newAccountType: accountType,
          rememberCorrection: rememberCorrection
        };
      }
      
      // Otherwise create new pending correction
      return {
        orderNumber: selectedOrder.orderNum,
        oldCustomerId: selectedOrder.customerId || '',
        newCustomerId: newCustomerId,
        newCustomerName: customerName,
        newAccountType: accountType,
        rememberCorrection: rememberCorrection
      };
    });
  };

  const handleAccountTypeChange = (accountType: string) => {
    if (!selectedOrder) return;

    // Change account type while preserving customer selection
    setPendingCorrection(prev => {
      // If there's an existing pending correction, just update the account type
      if (prev && prev.orderNumber === selectedOrder.orderNum) {
        return {
          ...prev,
          newAccountType: accountType
        };
      }
      
      // Otherwise create new pending correction with current customer
      return {
        orderNumber: selectedOrder.orderNum,
        oldCustomerId: selectedOrder.customerId || '',
        newCustomerId: selectedOrder.customerId || '',
        newCustomerName: selectedOrder.customerName,
        newAccountType: accountType,
        rememberCorrection: rememberCorrection
      };
    });
  };

  const handleStageCorrection = () => {
    if (!pendingCorrection) return;

    // Move pending correction to staged corrections
    const newCorrections = new Map(stagedCorrections);
    newCorrections.set(pendingCorrection.orderNumber, pendingCorrection);
    
    setStagedCorrections(newCorrections);
    
    // Apply corrections to current validation data for real-time preview
    if (validationData) {
      const updatedData = applyClientSideCorrections(validationData, newCorrections);
      setValidationData(updatedData);
    }
    
    // Clear pending correction and selection
    setPendingCorrection(null);
    setSelectedOrder(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRevalidate = async () => {
    // Revalidate with staged corrections applied for preview
    await validateData(true);
  };

  const handleProceedWithCalculation = async () => {
    if (stagedCorrections.size === 0) {
      // No corrections to apply, proceed directly
      onProceed();
      return;
    }

    setIsSaving(true);
    
    try {
      // Apply all staged corrections
      const corrections = Array.from(stagedCorrections.values());
      
      for (const correction of corrections) {
        const response = await fetch('/api/fix-order-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(correction)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to fix order ${correction.orderNumber}: ${error.error}`);
        }
      }

      // All corrections applied successfully, proceed with calculation
      onProceed();
    } catch (error: any) {
      console.error('Failed to apply corrections:', error);
      alert(`Error applying corrections: ${error.message}`);
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (selectedOrder && selectedOrder.customerName) {
      setSearchQuery(selectedOrder.customerName);
      handleSearch(selectedOrder.customerName);
    }
  }, [selectedOrder]);

  if (!isOpen) return null;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Commission Calculation Validation</h2>
            <p className="text-sm text-blue-100 mt-1">
              {month}/{year} - Review data quality before processing
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="ml-3 text-gray-600">Validating data...</span>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-red-900">Validation Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <button
                    onClick={() => validateData()}
                    className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          ) : validationData ? (
            <>
              {/* Tabs */}
              <div className="border-b border-gray-200 px-6">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'overview'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('warnings')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'warnings'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Warnings
                    {validationData.warnings.length > 0 && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        {validationData.warnings.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('reps')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'reps'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Rep Breakdown
                  </button>
                  <button
                    onClick={() => setActiveTab('mapping')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'mapping'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Field Mapping
                    {validationData.fieldMapping.conflicts.length > 0 && (
                      <span className="ml-2 bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        {validationData.fieldMapping.conflicts.length}
                      </span>
                    )}
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-sm font-medium text-blue-900">Total Orders</div>
                        <div className="text-2xl font-bold text-blue-600 mt-1">
                          {validationData.statistics.totalOrders}
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="text-sm font-medium text-green-900">Matched Orders</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">
                          {validationData.statistics.matchedOrders}
                        </div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="text-sm font-medium text-yellow-900">Unmatched</div>
                        <div className="text-2xl font-bold text-yellow-600 mt-1">
                          {validationData.statistics.unmatchedOrders}
                        </div>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="text-sm font-medium text-purple-900">Active Reps</div>
                        <div className="text-2xl font-bold text-purple-600 mt-1">
                          {validationData.statistics.activeReps}
                        </div>
                      </div>
                    </div>

                    {/* Total Revenue */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-green-900">Total Revenue</div>
                          <div className="text-3xl font-bold text-green-600 mt-2">
                            ${parseFloat(validationData.statistics.totalRevenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
                      </div>
                    </div>

                    {/* Match Rate */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Order Match Rate</h3>
                        <span className="text-sm font-medium text-gray-600">
                          {((validationData.statistics.matchedOrders / validationData.statistics.totalOrders) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-500 h-3 rounded-full transition-all duration-500"
                          style={{
                            width: `${(validationData.statistics.matchedOrders / validationData.statistics.totalOrders) * 100}%`
                          }}
                        />
                      </div>
                      <p className="text-sm text-gray-600 mt-3">
                        {validationData.statistics.matchedOrders} of {validationData.statistics.totalOrders} orders will be processed
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'warnings' && (
                  <div className="space-y-4">
                    {/* Staged Corrections Banner */}
                    {stagedCorrections.size > 0 && (
                      <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                          <div className="flex-1">
                            <h3 className="font-bold text-blue-900 text-lg mb-2">
                              {stagedCorrections.size} Correction{stagedCorrections.size > 1 ? 's' : ''} Staged
                            </h3>
                            <p className="text-sm text-blue-800 mb-3">
                              These changes will be applied when you click &quot;Proceed with Calculation&quot;
                            </p>
                            <div className="space-y-2">
                              {Array.from(stagedCorrections.values()).map((correction) => (
                                <div key={correction.orderNumber} className="bg-white border border-blue-200 rounded-lg p-3 flex justify-between items-center">
                                  <div>
                                    <p className="font-semibold text-gray-900">Order {correction.orderNumber}</p>
                                    <p className="text-sm text-gray-600">
                                      Will link to: {correction.newCustomerName} (ID: {correction.newCustomerId})
                                    </p>
                                    <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-semibold ${
                                      correction.newAccountType === 'Wholesale' ? 'bg-green-100 text-green-800' :
                                      correction.newAccountType === 'Distributor' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {correction.newAccountType}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const newCorrections = new Map(stagedCorrections);
                                      newCorrections.delete(correction.orderNumber);
                                      setStagedCorrections(newCorrections);
                                    }}
                                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Interactive Excluded Orders Section */}
                    {validationData.excludedOrders && (
                      <>
                        {(() => {
                          const allExcluded = [
                            ...(validationData.excludedOrders.retail || []),
                            ...(validationData.excludedOrders.customerNotFound || [])
                          ];
                          
                          if (allExcluded.length > 0) {
                            return (
                              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                                <div className="flex items-start gap-3 mb-4">
                                  <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                                  <div className="flex-1">
                                    <h3 className="font-bold text-yellow-900 text-lg mb-2">
                                      {allExcluded.length} Orders Excluded - Click to Fix
                                    </h3>
                                    <p className="text-sm text-yellow-800 mb-4">
                                      These orders will not be included in commission calculations. Click on an order to search for the correct customer and link it.
                                    </p>

                                    <div className="space-y-2">
                                      {allExcluded.map((order) => (
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
                                            <div className="flex-1">
                                              <p className="font-semibold text-gray-900">Order {order.orderNum}</p>
                                              <p className="text-sm text-gray-600">{order.customerName}</p>
                                              {order.customerId && (
                                                <p className="text-xs text-gray-500">Customer ID: {order.customerId}</p>
                                              )}
                                            </div>
                                            <div className="flex items-start gap-3">
                                              <div className="text-right">
                                                <p className="font-bold text-gray-900">${order.revenue.toFixed(2)}</p>
                                                <p className="text-sm text-gray-600">Rep: {order.salesPerson}</p>
                                              </div>
                                              {selectedOrder?.orderNum === order.orderNum && pendingCorrection?.orderNumber === order.orderNum && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStageCorrection();
                                                  }}
                                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold flex items-center gap-2 shadow-lg"
                                                >
                                                  <CheckCircle className="w-4 h-4" />
                                                  Ready - Stage
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          {selectedOrder?.orderNum === order.orderNum && (
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                              <p className="text-sm font-semibold text-gray-700 mb-3">Search for correct customer:</p>
                                              
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
                                                        onClick={() => handleLinkCustomer(result.id, result.name, result.accountType || 'Retail')}
                                                        disabled={isSaving}
                                                        className={`w-full px-4 py-2 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-semibold ${
                                                          pendingCorrection?.newCustomerId === result.id 
                                                            ? 'bg-green-600 text-white hover:bg-green-700' 
                                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                                        }`}
                                                      >
                                                        {pendingCorrection?.newCustomerId === result.id ? '✓ Selected' : 'Select This Customer'}
                                                      </button>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}

                                              {/* Manual Account Type Override */}
                                              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                                <p className="text-sm font-semibold text-gray-700 mb-2">Or manually change account type:</p>
                                                <div className="flex gap-2">
                                                  {['Retail', 'Wholesale', 'Distributor'].map((type) => {
                                                    // Determine current account type from order data
                                                    const currentAccountType = selectedOrder?.accountType || 'Retail';
                                                    
                                                    // Check if this type is selected in pending correction
                                                    const isSelected = pendingCorrection?.orderNumber === selectedOrder?.orderNum && 
                                                                      pendingCorrection?.newAccountType === type;
                                                    
                                                    // Check if this is the current type (before any changes)
                                                    const isCurrent = !pendingCorrection && type === currentAccountType;
                                                    
                                                    return (
                                                      <button
                                                        key={type}
                                                        onClick={() => handleAccountTypeChange(type)}
                                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                                          isSelected 
                                                            ? 'bg-green-600 text-white border-2 border-green-700 shadow-lg'
                                                            : isCurrent
                                                            ? 'bg-yellow-100 text-yellow-900 border-2 border-yellow-400'
                                                            : type === 'Wholesale' ? 'bg-green-100 text-green-800 hover:bg-green-200 border-2 border-green-300' :
                                                              type === 'Distributor' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-2 border-blue-300' :
                                                              'bg-gray-100 text-gray-800 hover:bg-gray-200 border-2 border-gray-300'
                                                        }`}
                                                      >
                                                        {isSelected ? '✓ ' : isCurrent ? '→ ' : ''}{type}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">
                                                  Current account type shown with →. This will keep the current customer but change the account type.
                                                </p>
                                              </div>

                                              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={rememberCorrection}
                                                  onChange={(e) => setRememberCorrection(e.target.checked)}
                                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <span>Remember this correction (add old ID as alias)</span>
                                              </label>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    )}

                    {/* Original Warnings Display */}
                    {validationData.warnings.length === 0 ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h3 className="font-semibold text-green-900">No Warnings</h3>
                        <p className="text-sm text-green-700 mt-1">All data looks good!</p>
                      </div>
                    ) : (
                      validationData.warnings.map((warning, index) => (
                        <div
                          key={index}
                          className={`border rounded-lg p-4 ${getSeverityColor(warning.severity)}`}
                        >
                          <div className="flex items-start">
                            {getSeverityIcon(warning.severity)}
                            <div className="ml-3 flex-1">
                              <h4 className="font-medium text-gray-900">{warning.message}</h4>
                              {warning.details && warning.details.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-sm text-gray-700 font-medium mb-1">Affected items:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {warning.details.slice(0, 10).map((detail, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white border border-gray-300"
                                      >
                                        {detail}
                                      </span>
                                    ))}
                                    {warning.details.length > 10 && (
                                      <span className="text-xs text-gray-600 self-center">
                                        +{warning.details.length - 10} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'reps' && (
                  <div className="space-y-4">
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Rep Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Rep ID
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Orders
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Est. Revenue
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {validationData.repBreakdown.map((rep, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {rep.repName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {rep.repId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                {rep.orderCount}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                ${rep.estimatedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    rep.status === 'active'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {rep.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'mapping' && (
                  <div className="space-y-6">
                    {/* Conflicts */}
                    {validationData.fieldMapping.conflicts.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                          <div>
                            <h4 className="font-medium text-red-900">Field Mapping Conflicts</h4>
                            <ul className="mt-2 space-y-1">
                              {validationData.fieldMapping.conflicts.map((conflict, index) => (
                                <li key={index} className="text-sm text-red-700">
                                  • {conflict}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Field Mappings */}
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">Detected Field Mappings</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          The system detected these field variations in your data
                        </p>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {Object.entries(validationData.fieldMapping.detected).map(([field, variations]) => (
                          <div key={field} className="px-6 py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 mb-2">{field}</div>
                                <div className="flex flex-wrap gap-2">
                                  {variations.map((variation, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200"
                                    >
                                      {variation}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <ArrowRight className="w-5 h-5 text-gray-400 mx-4 flex-shrink-0" />
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                                  {validationData.fieldMapping.suggested[field]}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center space-x-3">
            {stagedCorrections.size > 0 && (
              <span className="text-sm text-blue-600 font-medium">
                {stagedCorrections.size} correction{stagedCorrections.size > 1 ? 's' : ''} staged
              </span>
            )}
            {validationData && !validationData.valid && stagedCorrections.size === 0 && (
              <span className="text-sm text-red-600 font-medium">
                ⚠️ Errors must be resolved before proceeding
              </span>
            )}
            <button
              onClick={handleRevalidate}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Revalidate
            </button>
            <button
              onClick={handleProceedWithCalculation}
              disabled={isSaving || loading || (!validationData?.valid && stagedCorrections.size === 0)}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying Changes...
                </>
              ) : (
                <>
                  Proceed with Calculation
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
