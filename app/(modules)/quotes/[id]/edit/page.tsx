'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, X } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getQuoteById } from '@/lib/services/quoteService';
import { Quote, QuoteLineItem } from '@/types/quote';
import CustomerLookup from '@/components/quotes/CustomerLookup';
import ProductSelector from '@/components/quotes/ProductSelector';
import QuoteBuilder from '@/components/quotes/QuoteBuilder';
import QuoteCalculation from '@/components/quotes/QuoteCalculation';
import toast from 'react-hot-toast';

export default function EditQuotePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  // Form state - will be populated from loaded quote
  const [quoteName, setQuoteName] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [pricingMode, setPricingMode] = useState<'distribution' | 'wholesale'>('distribution');
  const [paymentMethod, setPaymentMethod] = useState<'wireTransfer' | 'check' | 'creditCard'>('wireTransfer');
  const [internalNotes, setInternalNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  useEffect(() => {
    if (user) {
      loadQuote();
    }
  }, [user, params.id]);

  async function loadQuote() {
    try {
      const quoteData = await getQuoteById(params.id);
      if (quoteData) {
        setQuote(quoteData);
        
        // Populate form fields
        setQuoteName(quoteData.quoteName);
        setCustomer(quoteData.customer);
        setLineItems(quoteData.lineItems);
        setPricingMode(quoteData.pricingMode);
        setPaymentMethod(quoteData.paymentMethod);
        setInternalNotes(quoteData.internalNotes || '');
        setCustomerNotes(quoteData.customerNotes || '');
      } else {
        toast.error('Quote not found');
        router.push('/quotes');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading quote:', error);
      toast.error('Failed to load quote');
      setLoading(false);
    }
  }

  function handleAddProduct(product: any) {
    const newLineItem: QuoteLineItem = {
      id: `${Date.now()}-${Math.random()}`,
      product: {
        id: product.id,
        productNum: product.productNum,
        name: product.productDescription,
        category: product.category,
        image: product.image,
        unitsPerCase: product.unitsPerCase,
        basePrice: pricingMode === 'distribution' ? product.baseDistributionPrice : product.baseWholesalePrice,
      },
      masterCases: 1,
      displayBoxes: 0,
      unitPrice: pricingMode === 'distribution' ? product.baseDistributionPrice : product.baseWholesalePrice,
      lineTotal: pricingMode === 'distribution' ? product.baseDistributionPrice : product.baseWholesalePrice,
      notes: '',
    };

    setLineItems([...lineItems, newLineItem]);
    toast.success('Product added to quote');
  }

  function handleUpdateLineItem(itemId: string, updates: Partial<QuoteLineItem>) {
    setLineItems(lineItems.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, ...updates };
        
        // Recalculate line total if quantity changed
        if (updates.masterCases !== undefined || updates.displayBoxes !== undefined) {
          const totalUnits = (updatedItem.masterCases * updatedItem.product.unitsPerCase) + (updatedItem.displayBoxes || 0);
          updatedItem.lineTotal = totalUnits * updatedItem.unitPrice;
        }
        
        return updatedItem;
      }
      return item;
    }));
  }

  function handleRemoveLineItem(itemId: string) {
    setLineItems(lineItems.filter(item => item.id !== itemId));
    toast.success('Item removed');
  }

  async function handleSave() {
    if (!customer) {
      toast.error('Please select a customer');
      return;
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    if (!quoteName.trim()) {
      toast.error('Please enter a quote name');
      return;
    }

    setSaving(true);
    try {
      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const totalCases = lineItems.reduce((sum, item) => sum + item.masterCases, 0);

      const calculation = {
        subtotal,
        tierDiscount: 0,
        shipping: 0,
        creditCardFee: paymentMethod === 'creditCard' ? subtotal * 0.03 : 0,
        total: subtotal + (paymentMethod === 'creditCard' ? subtotal * 0.03 : 0),
        totalCases,
      };

      const quoteData = {
        quoteName,
        customer,
        lineItems,
        pricingMode,
        paymentMethod,
        internalNotes,
        customerNotes,
        calculation,
        shipping: {
          zone: '',
          zoneName: '',
          state: customer.state || '',
          ltlPercent: 0,
          calculatedAmount: 0,
        },
      };

      const response = await fetch(`/api/quotes/${params.id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData),
      });

      if (!response.ok) {
        throw new Error('Failed to update quote');
      }

      toast.success('Quote updated successfully!');
      router.push(`/quotes/${params.id}`);
    } catch (error) {
      console.error('Error updating quote:', error);
      toast.error('Failed to update quote');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Quote not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/quotes/${params.id}`)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Edit Quote</h1>
              <p className="text-sm text-gray-500">{quote.quoteNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/quotes/${params.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quote Name */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quote Name
            </label>
            <input
              type="text"
              value={quoteName}
              onChange={(e) => setQuoteName(e.target.value)}
              placeholder="Enter quote name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Customer Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
            <CustomerLookup
              onSelectCustomer={setCustomer}
              selectedCustomer={customer}
            />
          </div>

          {/* Product Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Products</h2>
            <ProductSelector
              onAddProduct={handleAddProduct}
              pricingMode={pricingMode}
            />
          </div>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Items</h2>
              <QuoteBuilder
                lineItems={lineItems}
                onUpdateLineItem={handleUpdateLineItem}
                onRemoveLineItem={handleRemoveLineItem}
              />
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm p-6">
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
                  placeholder="Add internal notes..."
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
                  placeholder="Add customer-facing notes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing Mode */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing Mode</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="pricingMode"
                  value="distribution"
                  checked={pricingMode === 'distribution'}
                  onChange={(e) => setPricingMode(e.target.value as 'distribution' | 'wholesale')}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm font-medium text-gray-900">Distribution</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="pricingMode"
                  value="wholesale"
                  checked={pricingMode === 'wholesale'}
                  onChange={(e) => setPricingMode(e.target.value as 'distribution' | 'wholesale')}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm font-medium text-gray-900">Wholesale</span>
              </label>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="wireTransfer"
                  checked={paymentMethod === 'wireTransfer'}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm font-medium text-gray-900">Wire Transfer</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="check"
                  checked={paymentMethod === 'check'}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm font-medium text-gray-900">Check</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="creditCard"
                  checked={paymentMethod === 'creditCard'}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-4 h-4 text-primary-600"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">Credit Card</span>
                  <p className="text-xs text-gray-500">+3% processing fee</p>
                </div>
              </label>
            </div>
          </div>

          {/* Calculation */}
          <QuoteCalculation
            lineItems={lineItems}
            customer={customer}
            paymentMethod={paymentMethod}
          />
        </div>
      </div>
    </div>
  );
}
