'use client';

import React, { useState } from 'react';
import { Calculator, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CommissionTestTab() {
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [commissionMonth, setCommissionMonth] = useState('2025-12');

  const calculateCommissions = async () => {
    setCalculating(true);
    try {
      const response = await fetch('/api/calculate-commissions-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionMonth })
      });

      const data = await response.json();

      if (data.success) {
        setResults(data);
        toast.success(`Calculated ${data.summary.calculatedOrders} commissions in ${data.duration}ms`);
      } else {
        toast.error(data.error || 'Calculation failed');
      }
    } catch (error: any) {
      console.error('Error calculating commissions:', error);
      toast.error('Failed to calculate commissions');
    } finally {
      setCalculating(false);
    }
  };

  const exportToExcel = () => {
    if (!results) return;

    // Create CSV content
    const headers = [
      'Order #',
      'Sales Person',
      'Rep Name',
      'Customer',
      'Account Type',
      'Status',
      'Line Items',
      'Included Items',
      'Excluded Items',
      'Order Amount',
      'Commission Rate',
      'Commission Amount'
    ];

    const rows = results.results.map((r: any) => [
      r.orderNum,
      r.salesPerson,
      r.repName,
      r.customerName,
      r.accountType,
      r.status,
      r.lineItemCount,
      r.includedItemCount,
      r.excludedItemCount,
      r.orderAmount.toFixed(2),
      r.commissionRate + '%',
      r.commissionAmount.toFixed(2)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-v2-${commissionMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Exported to CSV');
  };

  const exportDetailedExcel = () => {
    if (!results) return;

    // Create detailed CSV with line items
    const rows: string[] = [];
    
    // Header
    rows.push('Order #,Sales Person,Rep Name,Customer,Account Type,Product,Quantity,Amount,Included/Excluded,Commission Rate,Commission Amount');

    results.results.forEach((order: any) => {
      // Included items
      order.includedItems.forEach((item: any, idx: number) => {
        rows.push([
          idx === 0 ? order.orderNum : '',
          idx === 0 ? order.salesPerson : '',
          idx === 0 ? order.repName : '',
          idx === 0 ? order.customerName : '',
          idx === 0 ? order.accountType : '',
          `"${item.product}"`,
          item.quantity,
          item.amount.toFixed(2),
          'Included',
          idx === 0 ? order.commissionRate + '%' : '',
          idx === 0 ? order.commissionAmount.toFixed(2) : ''
        ].join(','));
      });

      // Excluded items
      order.excludedItems.forEach((item: any) => {
        rows.push([
          '',
          '',
          '',
          '',
          '',
          `"${item.product}"`,
          '',
          item.amount.toFixed(2),
          `Excluded (${item.reason})`,
          '',
          ''
        ].join(','));
      });

      // Blank line between orders
      rows.push('');
    });

    const csv = rows.join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-v2-detailed-${commissionMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Exported detailed CSV');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-primary-600" />
              Commission Calculation Engine V2 (Test)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              New calculation engine for testing and verification
            </p>
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commission Month
            </label>
            <input
              type="text"
              value={commissionMonth}
              onChange={(e) => setCommissionMonth(e.target.value)}
              placeholder="YYYY-MM"
              className="input w-full"
            />
          </div>

          <button
            onClick={calculateCommissions}
            disabled={calculating}
            className="btn-primary flex items-center gap-2"
          >
            {calculating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                Calculate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Summary */}
      {results && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Summary</h3>
              <div className="flex gap-2">
                <button
                  onClick={exportToExcel}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Summary
                </button>
                <button
                  onClick={exportDetailedExcel}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Detailed
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Total Orders</div>
                <div className="text-2xl font-bold text-blue-900">{results.summary.totalOrders}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Calculated</div>
                <div className="text-2xl font-bold text-green-900">{results.summary.calculatedOrders}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Total Revenue</div>
                <div className="text-2xl font-bold text-purple-900">
                  ${results.summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-sm text-orange-600 font-medium">Total Commission</div>
                <div className="text-2xl font-bold text-orange-900">
                  ${results.summary.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600">Skipped Retail</div>
                <div className="text-lg font-semibold text-gray-900">{results.summary.skippedRetail}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600">No Customer</div>
                <div className="text-lg font-semibold text-gray-900">{results.summary.skippedNoCustomer}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600">Inactive Rep</div>
                <div className="text-lg font-semibold text-gray-900">{results.summary.skippedInactiveRep}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600">Admin</div>
                <div className="text-lg font-semibold text-gray-900">{results.summary.skippedAdmin}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600">Shopify</div>
                <div className="text-lg font-semibold text-gray-900">{results.summary.skippedShopify}</div>
              </div>
            </div>
          </div>

          {/* By Rep */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">By Sales Rep</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rep</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.summary.byRep.map((rep: any) => (
                    <tr key={rep.salesPerson} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{rep.repName}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{rep.orders}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        ${rep.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-primary-600">
                        ${rep.commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Detailed Results ({results.results.length} orders)
            </h3>
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rep</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.results.map((order: any) => (
                    <tr key={order.salesOrderId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{order.orderNum}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.repName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.customerName}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.accountType === 'Wholesale' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {order.accountType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {order.includedItemCount}
                        {order.excludedItemCount > 0 && (
                          <span className="text-gray-400"> (-{order.excludedItemCount})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        ${order.orderAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">{order.commissionRate}%</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-primary-600">
                        ${order.commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
