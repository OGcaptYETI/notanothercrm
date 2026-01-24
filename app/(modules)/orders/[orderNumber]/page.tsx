'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getTrackingUrl } from '@/types/shipstation';
import { 
  ArrowLeft, 
  Package, 
  Calendar, 
  DollarSign, 
  User, 
  Building2,
  Phone,
  Mail,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Truck,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw
} from 'lucide-react';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const orderNumber = params.orderNumber as string;
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrderDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(`[OrderDetailPage] Fetching order: ${orderNumber}`);
      const response = await fetch(`/api/orders/${orderNumber}`);
      console.log(`[OrderDetailPage] Response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OrderDetailPage] Error response:`, errorText);
        throw new Error('Order not found');
      }
      const data = await response.json();
      console.log(`[OrderDetailPage] Order data loaded:`, data);
      setOrder(data);
    } catch (error: any) {
      console.error('[OrderDetailPage] Error loading order:', error);
      setError(error.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (user && orderNumber) {
      loadOrderDetails();
    }
  }, [user, orderNumber, loadOrderDetails]);

  const refreshShippingInfo = async () => {
    setRefreshing(true);
    try {
      // Trigger a fresh sync from ShipStation for this order's date range
      const orderDate = new Date(order.orderDate);
      const startDate = new Date(orderDate.getTime() - 24 * 60 * 60 * 1000); // 1 day before
      const endDate = new Date(orderDate.getTime() + 24 * 60 * 60 * 1000); // 1 day after
      
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

      // Reload order details to get fresh data
      await loadOrderDetails();
    } catch (error: any) {
      console.error('Error refreshing shipping info:', error);
      alert('Failed to refresh shipping info: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleNavigation = (targetOrderNumber: string | null) => {
    if (targetOrderNumber) {
      router.push(`/orders/${targetOrderNumber}`);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#93D500]"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
        </div>
        <div className="p-6">
          <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700">Order Not Found</h2>
            <p className="text-gray-500 mt-2">{error || 'This order does not exist.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/shipments')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Shipments"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6 text-gray-400" />
                <h1 className="text-xl font-bold text-gray-900">Order #{order.orderNumber}</h1>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  {order.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 ml-10 mt-1">
                {new Date(order.orderDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNavigation(order.navigation.previousOrder)}
              disabled={!order.navigation.previousOrder}
              className={`p-2 rounded-lg transition-colors ${
                order.navigation.previousOrder 
                  ? 'hover:bg-gray-100 text-gray-700' 
                  : 'text-gray-300 cursor-not-allowed'
              }`}
              title="Previous Order"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600 px-3">
              {order.navigation.currentIndex + 1} of {order.navigation.totalOrders}
            </span>
            <button
              onClick={() => handleNavigation(order.navigation.nextOrder)}
              disabled={!order.navigation.nextOrder}
              className={`p-2 rounded-lg transition-colors ${
                order.navigation.nextOrder 
                  ? 'hover:bg-gray-100 text-gray-700' 
                  : 'text-gray-300 cursor-not-allowed'
              }`}
              title="Next Order"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Line Items */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider" style={{width: '60px'}}>
                        Image
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {order.lineItems.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.product}
                              className="w-12 h-12 object-cover rounded border"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.product}</p>
                            {item.sku && (
                              <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-900">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(item.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                        Order Total:
                      </td>
                      <td className="px-6 py-4 text-right text-lg font-bold text-green-600">
                        {formatCurrency(order.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar - Customer Info */}
          <div className="space-y-6">
            {/* Customer Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-[#93D500]" />
                <h2 className="text-lg font-semibold text-gray-900">Customer</h2>
              </div>
              
              <div className="space-y-3">
                <div>
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
                    <p className="text-xs text-gray-500">Account #{order.customer.accountNumber}</p>
                  )}
                </div>

                {order.customer.address && (order.customer.address.street || order.customer.address.city) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="text-sm text-gray-600">
                      {order.customer.address.street && <div>{order.customer.address.street}</div>}
                      <div>
                        {order.customer.address.city && `${order.customer.address.city}, `}
                        {order.customer.address.state} {order.customer.address.zip}
                      </div>
                    </div>
                  </div>
                )}

                {order.customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${order.customer.phone}`} className="text-sm text-gray-600 hover:text-[#93D500]">
                      {order.customer.phone}
                    </a>
                  </div>
                )}

                {order.customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${order.customer.email}`} className="text-sm text-gray-600 hover:text-[#93D500] truncate">
                      {order.customer.email}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order Date</span>
                  <span className="font-medium text-gray-900">
                    {new Date(order.orderDate).toLocaleDateString()}
                  </span>
                </div>
                
                {order.salesPerson && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sales Rep</span>
                    <span className="font-medium text-gray-900">{order.salesPerson}</span>
                  </div>
                )}
                
                {order.accountType && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Account Type</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {order.accountType}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm pt-3 border-t border-gray-200">
                  <span className="text-gray-600">Items</span>
                  <span className="font-medium text-gray-900">{order.lineItems.length}</span>
                </div>
                
                <div className="flex justify-between pt-3 border-t-2 border-gray-300">
                  <span className="text-base font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Shipping & Tracking */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#93D500]" />
                  <h2 className="text-lg font-semibold text-gray-900">Shipping</h2>
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
                  {order.shipping.shipments.map((shipment: any, index: number) => {
                    const trackingUrl = getTrackingUrl(shipment.carrierCode, shipment.trackingNumber);
                    
                    return (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {shipment.carrierCode} {shipment.serviceCode}
                            </p>
                            {shipment.carrierStatus && (
                              <p className="text-xs text-gray-600 mt-1">
                                Status: {shipment.carrierStatus}
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
                            {trackingUrl ? (
                              <a
                                href={trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-mono"
                              >
                                {shipment.trackingNumber}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <p className="text-sm text-gray-900 font-mono">{shipment.trackingNumber}</p>
                            )}
                          </div>
                        )}
                        
                        <div className="pt-2">
                          <a
                            href="/shipments"
                            className="text-xs text-[#93D500] hover:text-[#84c000] flex items-center gap-1"
                          >
                            View all shipments
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : order.shipping ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    {order.shipping.orderStatus === 'awaiting_shipment' 
                      ? 'Order is awaiting shipment. Tracking information will appear here once the order ships.'
                      : 'No shipments found for this order.'}
                  </p>
                  {order.shipping.orderStatus && (
                    <p className="text-xs text-gray-500 mt-2">
                      Status: <span className="font-medium">{order.shipping.orderStatus.replace(/_/g, ' ')}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">
                    No shipping information available
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Shipping data is only available for orders from the last 15 days
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
