'use client';

import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface DataQualityIssue {
  type: 'comma_in_id' | 'missing_field' | 'invalid_date' | 'customer_not_found' | 'customer_mismatch' | 'duplicate_id';
  severity: 'error' | 'warning' | 'info';
  field: string;
  value: any;
  suggestion?: string;
}

interface PreviewOrder {
  rowIndex: number;
  soNumber: string;
  salesOrderId: string;
  accountId: string;
  customerName: string;
  salesPerson: string;
  issuedDate: string;
  lineItemCount: number;
  totalRevenue: number;
  issues: DataQualityIssue[];
  sanitizedData: {
    accountId: string;
    salesOrderId: string;
    lineItemIds: string[];
  };
}

interface PreviewData {
  totalRows: number;
  totalOrders: number;
  previewOrders: PreviewOrder[];
  summaryByRep: Array<{
    rep: string;
    orders: number;
    revenue: number;
    formatted: string;
  }>;
  globalIssues: {
    commaInIds: number;
    customerNotFound: number;
    customerMismatch: number;
    missingFields: number;
    invalidDates: number;
  };
  readyToImport: boolean;
}

interface ImportPreviewModalProps {
  preview: PreviewData;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ImportPreviewModal({ preview, onConfirm, onCancel }: ImportPreviewModalProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  const hasErrors = preview.globalIssues.invalidDates > 0 || preview.globalIssues.missingFields > 0;
  const hasWarnings = preview.globalIssues.commaInIds > 0 || preview.globalIssues.customerNotFound > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600">
          <div>
            <h2 className="text-xl font-bold text-white">Import Preview & Validation</h2>
            <p className="text-sm text-blue-100 mt-1">
              Review data quality before importing {preview.totalOrders} orders
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Orders</div>
              <div className="text-2xl font-bold text-blue-600">{preview.totalOrders}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Line Items</div>
              <div className="text-2xl font-bold text-green-600">{preview.totalRows}</div>
            </div>
            <div className={`rounded-lg p-4 ${hasErrors ? 'bg-red-50' : 'bg-gray-50'}`}>
              <div className="text-sm text-gray-600">Errors</div>
              <div className={`text-2xl font-bold ${hasErrors ? 'text-red-600' : 'text-gray-400'}`}>
                {preview.globalIssues.invalidDates + preview.globalIssues.missingFields}
              </div>
            </div>
            <div className={`rounded-lg p-4 ${hasWarnings ? 'bg-yellow-50' : 'bg-gray-50'}`}>
              <div className="text-sm text-gray-600">Warnings</div>
              <div className={`text-2xl font-bold ${hasWarnings ? 'text-yellow-600' : 'text-gray-400'}`}>
                {preview.globalIssues.commaInIds + preview.globalIssues.customerNotFound}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">New Customers</div>
              <div className="text-2xl font-bold text-purple-600">{preview.globalIssues.customerNotFound}</div>
            </div>
          </div>

          {/* Global Issues Alert */}
          {(hasErrors || hasWarnings) && (
            <div className={`rounded-lg p-4 mb-6 ${hasErrors ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              <div className="flex items-start gap-3">
                {hasErrors ? (
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold ${hasErrors ? 'text-red-900' : 'text-yellow-900'}`}>
                    {hasErrors ? 'Data Quality Issues Detected' : 'Data Quality Warnings'}
                  </h3>
                  <ul className={`mt-2 space-y-1 text-sm ${hasErrors ? 'text-red-700' : 'text-yellow-700'}`}>
                    {preview.globalIssues.commaInIds > 0 && (
                      <li>• {preview.globalIssues.commaInIds} IDs contain commas (will be sanitized)</li>
                    )}
                    {preview.globalIssues.customerNotFound > 0 && (
                      <li>• {preview.globalIssues.customerNotFound} new customers will be created</li>
                    )}
                    {preview.globalIssues.customerMismatch > 0 && (
                      <li>• {preview.globalIssues.customerMismatch} customer name mismatches detected</li>
                    )}
                    {preview.globalIssues.invalidDates > 0 && (
                      <li>• {preview.globalIssues.invalidDates} orders have invalid dates (BLOCKING)</li>
                    )}
                    {preview.globalIssues.missingFields > 0 && (
                      <li>• {preview.globalIssues.missingFields} orders missing required fields (BLOCKING)</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Summary */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Revenue by Sales Rep</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {preview.summaryByRep.map((item) => (
                  <div key={item.rep} className="flex items-center justify-between bg-white rounded p-3">
                    <div>
                      <div className="font-medium text-gray-900">{item.rep}</div>
                      <div className="text-sm text-gray-500">{item.orders} orders</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{item.formatted}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Orders */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Preview: First 10 Orders</h3>
            <div className="space-y-3">
              {preview.previewOrders.map((order) => (
                <div key={order.soNumber} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-gray-900">{order.soNumber}</span>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-sm text-gray-600">{order.customerName}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Account ID: <span className="font-mono">{order.accountId}</span></span>
                        <span>•</span>
                        <span>Sales Rep: {order.salesPerson}</span>
                        <span>•</span>
                        <span>{order.lineItemCount} items</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">
                        ${order.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">{order.issuedDate}</div>
                    </div>
                  </div>

                  {/* Issues */}
                  {order.issues.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {order.issues.map((issue, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1">
                            <span className="font-medium">{issue.field}:</span>{' '}
                            <span className="text-gray-600">{issue.value || '(empty)'}</span>
                            {issue.suggestion && (
                              <span className="text-gray-500"> → {issue.suggestion}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {order.issues.length === 0 && (
                    <div className="flex items-center gap-2 text-sm text-green-600 mt-3">
                      <CheckCircle className="w-4 h-4" />
                      <span>No issues detected</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {hasErrors ? (
              <span className="text-red-600 font-medium">
                ⚠️ Cannot import: Fix errors in CSV before proceeding
              </span>
            ) : hasWarnings ? (
              <span className="text-yellow-600">
                ⚠️ Warnings detected - data will be automatically sanitized
              </span>
            ) : (
              <span className="text-green-600 font-medium">
                ✓ Data looks good - ready to import
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={hasErrors}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                hasErrors
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {hasErrors ? 'Fix Errors First' : 'Confirm & Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
