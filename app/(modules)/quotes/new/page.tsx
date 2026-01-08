'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Save, Send, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import CustomerLookup from '@/components/quotes/CustomerLookup';
import ProductSelector from '@/components/quotes/ProductSelector';
import QuoteBuilder from '@/components/quotes/QuoteBuilder';
import QuoteCalculation from '@/components/quotes/QuoteCalculation';
import { QuoteCustomer, QuoteLineItem, PricingMode, PaymentMethod } from '@/types/quote';

export default function NewQuotePage() {
  const router = useRouter();
  const { user } = useAuth();
  
  // Quote state
  const [quoteName, setQuoteName] = useState('');
  const [customer, setCustomer] = useState<QuoteCustomer | undefined>();
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [pricingMode, setPricingMode] = useState<PricingMode>('distribution');
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wire');
  const [internalNotes, setInternalNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Auto-generate quote name when customer is selected
  useEffect(() => {
    if (customer && !quoteName) {
      const productCount = lineItems.length;
      const productText = productCount === 1 ? 'Product' : 'Products';
      setQuoteName(`${productCount} ${productText} Quote for ${customer.companyName}`);
    }
  }, [customer, lineItems.length, quoteName]);

  const handleAddLineItem = (item: QuoteLineItem) => {
    setLineItems([...lineItems, item]);
  };

  const handleUpdateLineItem = (index: number, updates: Partial<QuoteLineItem>) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], ...updates };
    setLineItems(updated);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSaveDraft = async () => {
    if (!user || !customer) return;

    setIsSaving(true);
    try {
      // Calculate totals (will be done by QuoteCalculation component)
      const calculation = {
        subtotal: lineItems.reduce((sum, item) => sum + item.lineTotal, 0),
        shipping: 0, // Will be calculated
        creditCardFee: 0,
        total: 0,
        totalCases: lineItems.reduce((sum, item) => sum + item.masterCases, 0),
      };

      const quoteData = {
        status: 'draft' as const,
        quoteName,
        customer,
        lineItems,
        pricingMode,
        paymentMethod,
        internalNotes,
        customerNotes,
        calculation,
        selectedTier,
        shipping: {
          zone: '',
          zoneName: '',
          state: customer.state || '',
          ltlPercent: 0,
          calculatedAmount: 0,
        },
        createdBy: user.uid,
        createdByEmail: user.email || '',
      };

      const response = await fetch('/api/quotes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData),
      });

      if (!response.ok) throw new Error('Failed to save quote');

      const result = await response.json();
      router.push(`/quotes/${result.quoteId}`);
    } catch (error) {
      console.error('Error saving quote:', error);
      alert('Failed to save quote. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = customer && lineItems.length > 0 && quoteName;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/quotes')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">New Quote</h1>
              <p className="text-sm text-gray-500">Create a new product quote for a customer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={!canSave || isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quote Name */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quote Name
            </label>
            <input
              type="text"
              value={quoteName}
              onChange={(e) => setQuoteName(e.target.value)}
              placeholder="e.g., Product Quote for Acme Corp"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Customer Lookup */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
            <CustomerLookup
              onCustomerSelect={setCustomer}
              selectedCustomer={customer}
            />
          </div>

          {/* Product Selector */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Select Products</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Pricing Tier:</span>
                  <select
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(Number(e.target.value))}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value={1}>Tier 1 (0-55 cases)</option>
                    <option value={2}>Tier 2 (56-111 cases)</option>
                    <option value={3}>Tier 3 (112+ cases)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Mode:</span>
                  <button
                    onClick={() => setPricingMode(pricingMode === 'distribution' ? 'wholesale' : 'distribution')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      pricingMode === 'wholesale'
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {pricingMode === 'wholesale' ? 'Wholesale' : 'Distribution'}
                  </button>
                </div>
              </div>
            </div>
            <ProductSelector
              pricingMode={pricingMode}
              selectedTier={selectedTier}
              onAddProduct={handleAddLineItem}
            />
          </div>

          {/* Quote Builder */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Line Items</h2>
            <QuoteBuilder
              lineItems={lineItems}
              pricingMode={pricingMode}
              onUpdateLineItem={handleUpdateLineItem}
              onRemoveLineItem={handleRemoveLineItem}
            />
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Internal Notes (Not visible to customer)
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  placeholder="Add internal notes about this quote..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Notes (Visible on quote)
                </label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes for the customer..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Quote Calculation */}
          <QuoteCalculation
            lineItems={lineItems}
            customer={customer}
            pricingMode={pricingMode}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
          />
        </div>
      </div>
    </div>
  );
}
