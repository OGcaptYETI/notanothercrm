'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, RefreshCw, Package, User, Calendar, DollarSign, Truck, Phone, Mail, MapPin } from 'lucide-react';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
}

export function OrderDetailModal({ isOpen, onClose, orderNumber }: OrderDetailModalProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrderDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderNumber}`);
      if (!response.ok) {
        throw new Error('Order not found');
      }
      const data = await response.json();
      setOrder(data);
    } catch (error: any) {
      console.error('Error loading order:', error);
      setError(error.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (isOpen && orderNumber) {
      loadOrderDetails();
    }
  }, [isOpen, orderNumber, loadOrderDetails]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const refreshShippingInfo = async () => {
    if (!order) return;
    setRefreshing(true);
    try {
      const orderDate = new Date(order.orderDate);
      const startDate = new Date(orderDate.getTime() - 24 * 60 * 60 * 1000);
      const endDate = new Date(orderDate.getTime() + 24 * 60 * 60 * 1000);
      
      const syncResponse = await fetch('/api/shipstation/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        })
      });

      if (!syncResponse.ok) {
        throw new Error('Failed to sync from ShipStation');
      }

      await loadOrderDetails();
    } catch (error: any) {
      console.error('Error refreshing shipping info:', error);
      alert('Failed to refresh shipping info: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-600 text-white grid place-items-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Order {orderNumber}
              </h2>
              {order && (
                <p className="text-sm text-gray-600">
                  {new Date(order.orderDate).toLocaleDateString()} • {order.status}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <a
              href={`/orders/${orderNumber}`}
              className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2 transition-colors"
              title="Open full page"
            >
              <ExternalLink className="w-4 h-4" />
              Open Full Page
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error || !order ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Package className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700">Order Not Found</h3>
              <p className="text-gray-500 mt-2">{error || 'This order does not exist.'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Warning for orders not synced to Fishbowl */}
              {(order as any)._notSyncedToFishbowl && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700 font-medium">
                        Not Synced to Fishbowl
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        This order is only in ShipStation and has not been synced to the Fishbowl system yet. Order details are from ShipStation shipping data.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Customer & Order Info Grid */}
              <div className="grid grid-cols-2 gap-6">
                {/* Customer Information */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-5 h-5 text-[#93D500]" />
                    <h3 className="text-lg font-semibold text-gray-900">Customer</h3>
                  </div>
                  <div className="space-y-3">
                    {order.customer.id ? (
                      <a 
                        href={`/accounts/${order.customer.id}`}
                        className="text-base font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {order.customer.name}
                      </a>
                    ) : (
                      <p className="text-base font-medium text-gray-900">{order.customer.name}</p>
                    )}
                    {order.customer.accountNumber && (
                      <p className="text-sm text-gray-600">Account: {order.customer.accountNumber}</p>
                    )}
                    {order.customer.address && (order.customer.address.street1 || order.customer.address.city) && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${order.customer.address.street1 || ''} ${order.customer.address.street2 || ''} ${order.customer.address.city || ''} ${order.customer.address.state || ''} ${order.customer.address.postalCode || ''}`.trim()
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 hover:underline transition-colors"
                        >
                          <p>{order.customer.address.street1}</p>
                          {order.customer.address.street2 && <p>{order.customer.address.street2}</p>}
                          <p>{order.customer.address.city}{order.customer.address.city && order.customer.address.state ? ', ' : ''}{order.customer.address.state} {order.customer.address.postalCode}</p>
                        </a>
                      </div>
                    )}
                    {order.customer.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${order.customer.phone}`} className="hover:text-[#93D500]">
                          {order.customer.phone}
                        </a>
                      </div>
                    )}
                    {order.customer.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${order.customer.email}`} className="hover:text-[#93D500]">
                          {order.customer.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-[#93D500]" />
                    <h3 className="text-lg font-semibold text-gray-900">Order Summary</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </span>
                    </div>
                    {order.salesRep && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Sales Rep:</span>
                        <span className="font-medium text-gray-900">{order.salesRep}</span>
                      </div>
                    )}
                    {order.accountType && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Account Type:</span>
                        <span className="font-medium text-gray-900">{order.accountType}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Items:</span>
                      <span className="font-medium text-gray-900">{order.lineItems.length}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex justify-between">
                        <span className="text-base font-semibold text-gray-900">Total:</span>
                        <span className="text-lg font-bold text-green-600">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-[#93D500]" />
                  <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-y border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Quantity</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Unit Price</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {order.lineItems.map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{item.product}</td>
                          <td className="px-4 py-3 text-gray-600">{item.description}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Shipping & Tracking */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-[#93D500]" />
                    <h3 className="text-lg font-semibold text-gray-900">Shipping</h3>
                  </div>
                  <button
                    onClick={refreshShippingInfo}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Refresh tracking info from ShipStation"
                  >
                    <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing...' : 'Refresh from ShipStation'}
                  </button>
                </div>
                
                {order.shipping && order.shipping.shipments && order.shipping.shipments.length > 0 ? (
                  <div className="space-y-3">
                    {order.shipping.shipments.map((shipment: any, index: number) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {shipment.carrierCode?.toUpperCase()} {shipment.serviceCode}
                            </p>
                            {(shipment.carrierStatus || shipment.shipmentStatus) && (
                              <p className="text-xs text-gray-600 mt-1">
                                Status: {shipment.carrierStatus || shipment.shipmentStatus}
                              </p>
                            )}
                          </div>
                          {shipment.shipDate && (
                            <p className="text-xs text-gray-500">
                              {new Date(shipment.shipDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        
                        {shipment.trackingNumber && (
                          <div className="pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Tracking Number:</p>
                            <a
                              href={`https://www.ups.com/track?tracknum=${shipment.trackingNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-mono"
                            >
                              {shipment.trackingNumber}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : order.shipping ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      {order.shipping.orderStatus === 'awaiting_shipment' 
                        ? 'Order is awaiting shipment. Tracking information will appear here once the order ships.'
                        : 'No shipments found for this order.'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">No shipping information available</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono">Esc</kbd> or click outside to close
          </p>
        </div>
      </div>
    </div>
  );
}
