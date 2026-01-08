'use client';

import React from 'react';
import { Trash2, Package } from 'lucide-react';
import { QuoteLineItem, PricingMode } from '@/types/quote';

interface QuoteBuilderProps {
  lineItems: QuoteLineItem[];
  pricingMode: PricingMode;
  onUpdateLineItem: (index: number, updates: Partial<QuoteLineItem>) => void;
  onRemoveLineItem: (index: number) => void;
}

export default function QuoteBuilder({
  lineItems,
  pricingMode,
  onUpdateLineItem,
  onRemoveLineItem,
}: QuoteBuilderProps) {
  
  const handleCasesChange = (index: number, masterCases: number) => {
    const item = lineItems[index];
    const displayBoxes = masterCases * item.product.unitsPerCase;
    const lineTotal = item.unitPrice * displayBoxes;
    
    onUpdateLineItem(index, {
      masterCases,
      displayBoxes,
      lineTotal,
    });
  };

  const handleDisplayBoxesChange = (index: number, displayBoxes: number) => {
    const item = lineItems[index];
    const masterCases = Math.floor(displayBoxes / item.product.unitsPerCase);
    const lineTotal = item.unitPrice * displayBoxes;
    
    onUpdateLineItem(index, {
      masterCases,
      displayBoxes,
      lineTotal,
    });
  };

  if (lineItems.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">No products added yet</p>
        <p className="text-xs text-gray-400 mt-1">Select products from the catalog above</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lineItems.map((item, index) => (
        <div
          key={item.id}
          className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
        >
          <div className="flex items-start gap-4">
            {/* Product Image */}
            {item.product.image && (
              <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={item.product.image.startsWith('http') ? item.product.image : `https://${item.product.image.replace(/^https?:\/\//, '')}`}
                  alt={item.product.name}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Product Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.product.name}</h3>
                  <p className="text-sm text-gray-500">{item.product.category}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {item.product.unitsPerCase} units per case • ${item.unitPrice.toFixed(2)}/unit
                  </p>
                </div>
                <button
                  onClick={() => onRemoveLineItem(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Quantity Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Master Cases
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.masterCases}
                    onChange={(e) => handleCasesChange(index, parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Display Boxes (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.displayBoxes}
                    onChange={(e) => handleDisplayBoxesChange(index, parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Line Total
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-semibold text-gray-900">
                    ${item.lineTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Line Item Notes (Optional)
                </label>
                <input
                  type="text"
                  value={item.notes || ''}
                  onChange={(e) => onUpdateLineItem(index, { notes: e.target.value })}
                  placeholder="Add notes for this line item..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="border-t-2 border-gray-200 pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Total Items:</span>
          <span className="font-semibold text-gray-900">{lineItems.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="font-medium text-gray-700">Total Cases:</span>
          <span className="font-semibold text-gray-900">
            {lineItems.reduce((sum, item) => sum + item.masterCases, 0)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="font-medium text-gray-700">Total Units:</span>
          <span className="font-semibold text-gray-900">
            {lineItems.reduce((sum, item) => sum + item.displayBoxes, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
