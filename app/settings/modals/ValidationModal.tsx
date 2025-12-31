'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';

interface ValidationWarning {
  type: 'unmatchedRep' | 'missingCustomer' | 'inactiveRep' | 'missingRate' | 'dataQuality';
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

  useEffect(() => {
    if (isOpen) {
      validateData();
    }
  }, [isOpen, month, year]);

  const validateData = async () => {
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
      
      const data = await response.json();
      setValidationData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to validate data');
    } finally {
      setLoading(false);
    }
  };

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
                    onClick={validateData}
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
                              {warning.orderNumbers && warning.orderNumbers.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-sm text-gray-700 font-medium mb-1">Order numbers:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {warning.orderNumbers.slice(0, 10).map((orderNum, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white border border-gray-300"
                                      >
                                        {orderNum}
                                      </span>
                                    ))}
                                    {warning.orderNumbers.length > 10 && (
                                      <span className="text-xs text-gray-600 self-center">
                                        +{warning.orderNumbers.length - 10} more
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
            {validationData && !validationData.valid && (
              <span className="text-sm text-red-600 font-medium">
                ⚠️ Errors must be resolved before proceeding
              </span>
            )}
            <button
              onClick={onProceed}
              disabled={!validationData || !validationData.valid}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              Proceed with Calculation
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
