'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Mail, Download, TrendingUp, Edit, Send, 
  CheckCircle, XCircle, Clock, User, MapPin, Phone, 
  Package, DollarSign, Truck, CreditCard, FileText,
  Copy, Share2, Trash2
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getQuoteById } from '@/lib/services/quoteService';
import { Quote, QuoteStatus } from '@/types/quote';
import toast from 'react-hot-toast';

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleStatusChange(newStatus: QuoteStatus) {
    if (!quote) return;

    setUpdating(true);
    try {
      // TODO: Implement status update API
      setQuote({ ...quote, status: newStatus });
      toast.success(`Quote ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  async function handleSendQuote() {
    toast.success('Email functionality coming soon!');
  }

  async function handleDownloadPDF() {
    toast.success('PDF generation coming soon!');
  }

  async function handleAddToPipeline() {
    toast.success('Pipeline integration coming soon!');
  }

  async function handleCopyLink() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  }

  async function handleDeleteQuote() {
    if (!quote) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/quotes/${quote.id}/delete`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete quote');
      }

      toast.success('Quote deleted successfully');
      router.push('/quotes');
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast.error('Failed to delete quote');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const statusColors: Record<QuoteStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-purple-100 text-purple-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    expired: 'bg-orange-100 text-orange-700',
  };

  const statusIcons: Record<QuoteStatus, React.ReactNode> = {
    draft: <FileText className="w-4 h-4" />,
    sent: <Send className="w-4 h-4" />,
    viewed: <Clock className="w-4 h-4" />,
    accepted: <CheckCircle className="w-4 h-4" />,
    declined: <XCircle className="w-4 h-4" />,
    expired: <Clock className="w-4 h-4" />,
  };

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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/quotes')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{quote.quoteNumber}</h1>
              <p className="text-sm text-gray-500">{quote.quoteName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 text-sm font-medium rounded-lg flex items-center gap-2 ${statusColors[quote.status]}`}>
              {statusIcons[quote.status]}
              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => router.push(`/quotes/${quote.id}/edit`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={handleSendQuote}
            disabled={updating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Mail className="w-4 h-4" />
            Send Email
          </button>
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            onClick={handleAddToPipeline}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            Add to Pipeline
          </button>
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy Link
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Quote</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this quote? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteQuote}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Quote
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              Customer Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Company Name</p>
                <p className="font-semibold text-gray-900">{quote.customer.companyName}</p>
              </div>
              {quote.customer.contactName && (
                <div>
                  <p className="text-sm text-gray-500">Contact Name</p>
                  <p className="font-semibold text-gray-900">{quote.customer.contactName}</p>
                </div>
              )}
              {quote.customer.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-semibold text-gray-900">{quote.customer.email}</p>
                </div>
              )}
              {quote.customer.phone && (
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-semibold text-gray-900">{quote.customer.phone}</p>
                </div>
              )}
              {quote.customer.street && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Address</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-900">{quote.customer.street}</p>
                      <p className="text-gray-900">
                        {quote.customer.city}, {quote.customer.state} {quote.customer.zip}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Account Type</p>
                <span className="inline-block px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded">
                  {quote.customer.accountType || 'N/A'}
                </span>
              </div>
              {quote.customer.accountNumber && (
                <div>
                  <p className="text-sm text-gray-500">Account Number</p>
                  <p className="font-semibold text-gray-900">{quote.customer.accountNumber}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600" />
              Line Items
            </h2>
            <div className="space-y-4">
              {quote.lineItems.map((item, index) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    {item.product.image && (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={item.product.image.startsWith('http') ? item.product.image : `https://${item.product.image.replace(/^https?:\/\//, '')}`}
                          alt={item.product.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{item.product.name}</h3>
                          <p className="text-sm text-gray-500">{item.product.category}</p>
                        </div>
                        <p className="text-lg font-bold text-gray-900 whitespace-nowrap">
                          ${item.lineTotal.toFixed(2)}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Master Cases</p>
                          <p className="font-semibold text-gray-900">{item.masterCases}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Display Boxes</p>
                          <p className="font-semibold text-gray-900">{item.displayBoxes}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Unit Price</p>
                          <p className="font-semibold text-gray-900">${item.unitPrice.toFixed(2)}</p>
                        </div>
                      </div>
                      {item.notes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                          <span className="font-medium">Note:</span> {item.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {(quote.internalNotes || quote.customerNotes) && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              {quote.internalNotes && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Internal Notes</p>
                  <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg">{quote.internalNotes}</p>
                </div>
              )}
              {quote.customerNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Customer Notes</p>
                  <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">{quote.customerNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quote Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-600" />
              Quote Summary
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold text-gray-900">${quote.calculation.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Shipping:</span>
                <span className="font-semibold text-gray-900">${quote.calculation.shipping.toFixed(2)}</span>
              </div>
              {quote.calculation.creditCardFee > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">CC Fee (3%):</span>
                  <span className="font-semibold text-gray-900">${quote.calculation.creditCardFee.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t-2 border-gray-200 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-primary-600">${quote.calculation.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Info */}
          {quote.shipping && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary-600" />
                Shipping
              </h2>
              <div className="space-y-2 text-sm">
                {quote.shipping.zoneName && (
                  <div>
                    <p className="text-gray-500">Zone</p>
                    <p className="font-semibold text-gray-900">{quote.shipping.zoneName}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">State</p>
                  <p className="font-semibold text-gray-900">{quote.shipping.state}</p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary-600" />
              Payment Method
            </h2>
            <p className="text-sm font-semibold text-gray-900 capitalize">{quote.paymentMethod.replace(/([A-Z])/g, ' $1').trim()}</p>
          </div>

          {/* Quote Details */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Created</p>
                <p className="font-semibold text-gray-900">{quote.createdAt.toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Created By</p>
                <p className="font-semibold text-gray-900">{quote.createdByEmail}</p>
              </div>
              {quote.sentAt && (
                <div>
                  <p className="text-gray-500">Sent</p>
                  <p className="font-semibold text-gray-900">{quote.sentAt.toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Pricing Mode</p>
                <p className="font-semibold text-gray-900 capitalize">{quote.pricingMode}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Items</p>
                <p className="font-semibold text-gray-900">{quote.lineItems.length}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Cases</p>
                <p className="font-semibold text-gray-900">{quote.calculation.totalCases}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
