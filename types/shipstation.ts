/**
 * ShipStation TypeScript Interfaces
 * Types for orders, shipments, and tracking data
 */

export interface ShipStationAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  phone?: string;
  residential?: boolean;
}

export interface ShipStationItem {
  orderItemId?: number;
  lineItemKey?: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
  weight?: {
    value: number;
    units: string;
  };
  options?: Array<{
    name: string;
    value: string;
  }>;
}

export interface ShipStationShipment {
  shipmentId: number | string;
  orderId?: number;
  orderNumber?: string;
  carrierCode: string;
  serviceCode?: string;
  trackingNumber: string;
  shipDate?: string;
  voided?: boolean;
  shipmentCost?: number;
  shipmentStatus?: string | null;
  carrierStatus?: string | null;
  modifiedAt?: string | null;
}

export interface ShipStationOrder {
  orderId: number;
  orderNumber: string;
  orderKey?: string;
  orderDate: string;
  createDate?: string;
  modifyDate?: string;
  paymentDate?: string;
  shipByDate?: string;
  orderStatus: string;
  customerEmail?: string;
  customerUsername?: string;
  billTo: ShipStationAddress;
  shipTo: ShipStationAddress;
  items: ShipStationItem[];
  orderTotal: number;
  amountPaid?: number;
  taxAmount?: number;
  shippingAmount?: number;
  customerNotes?: string;
  internalNotes?: string;
  gift?: boolean;
  giftMessage?: string;
  requestedShippingService?: string;
  carrierCode?: string;
  serviceCode?: string;
  packageCode?: string;
  confirmation?: string;
  shipments?: ShipStationShipment[];
  advancedOptions?: {
    source?: string;
    storeId?: number;
    customField1?: string;
    customField2?: string;
    customField3?: string;
  };
  // Computed/enriched fields
  _displayStatus?: string;
  _customerId?: string; // Enriched Copper/Fishbowl customer ID for linking
  _v2Status?: {
    status: string;
    shipmentId?: string;
    modifiedAt?: string;
  };
}

export interface ShipStationOrdersResponse {
  orders: ShipStationOrder[];
  total: number;
  page: number;
  pages: number;
}

export interface ShipStationShipmentsResponse {
  shipments: ShipStationShipment[];
  total: number;
  page: number;
  pages: number;
}

export interface ShipStationLabel {
  label_id: string;
  tracking_number: string;
  tracking_status: 'delivered' | 'in_transit' | 'unknown' | 'pending' | string;
  ship_date?: string;
  carrier_code?: string;
  service_code?: string;
}

export interface ShipStationLabelsResponse {
  labels: ShipStationLabel[];
  total: number;
  page: number;
  pages: number;
}

// Firestore cached order structure
export interface FirestoreShipStationOrder {
  orderId: number;
  orderNumber: string;
  orderDate: Date | { seconds: number; nanoseconds: number };
  orderStatus: string;
  customerEmail?: string;
  billTo: ShipStationAddress;
  shipTo: ShipStationAddress;
  items: ShipStationItem[];
  orderTotal: number;
  amountPaid?: number;
  taxAmount?: number;
  shippingAmount?: number;
  customerNotes?: string;
  internalNotes?: string;
  shipments: ShipStationShipment[];
  trackingStatus?: string;
  displayStatus?: string;
  lastSyncedAt: Date | { seconds: number; nanoseconds: number };
  expiresAt: Date | { seconds: number; nanoseconds: number };
}

export interface ShipStationSyncMeta {
  lastRunAt: Date | { seconds: number; nanoseconds: number };
  ordersProcessed: number;
  status: 'success' | 'error' | 'running';
  errorMessage?: string;
}

// Filter types for the UI
export type SourceFilter = 'all' | 'shopify' | 'reprally' | 'fishbowl';
export type StatusFilter = 'all' | 'delivered' | 'in_transit' | 'label_purchased' | 'awaiting';

// Tracking URL patterns
export const TRACKING_URLS: Record<string, string> = {
  'ups': 'https://www.ups.com/track?tracknum=',
  'usps': 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
  'fedex': 'https://www.fedex.com/fedextrack/?trknbr=',
  'stamps_com': 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
  'dhl': 'https://www.dhl.com/en/express/tracking.html?AWB=',
  'ontrac': 'https://www.ontrac.com/tracking/?number=',
  'lasership': 'https://www.lasership.com/track/',
};

// Status color mapping
export const STATUS_COLORS: Record<string, string> = {
  'delivered': '#155724',
  'out_for_delivery': '#20c997',
  'in_transit': '#28a745',
  'label_purchased': '#17a2b8',
  'label_created': '#17a2b8',
  'pending': '#6c757d',
  'awaiting_shipment': '#ffc107',
  'cancelled': '#dc3545',
  'shipped': '#28a745',
};

export function getTrackingUrl(carrier: string, trackingNumber: string): string {
  if (!carrier || !trackingNumber) return '';
  const c = carrier.toLowerCase();
  
  if (c.includes('ups')) return TRACKING_URLS.ups + encodeURIComponent(trackingNumber);
  if (c.includes('fedex')) return TRACKING_URLS.fedex + encodeURIComponent(trackingNumber);
  if (c.includes('usps') || c.includes('stamps')) return TRACKING_URLS.usps + encodeURIComponent(trackingNumber);
  if (c.includes('dhl')) return TRACKING_URLS.dhl + encodeURIComponent(trackingNumber);
  if (c.includes('ontrac')) return TRACKING_URLS.ontrac + encodeURIComponent(trackingNumber);
  if (c.includes('laser')) return TRACKING_URLS.lasership + encodeURIComponent(trackingNumber);
  
  return '';
}

export function getOrderSource(orderNumber: string): SourceFilter {
  if (!orderNumber) return 'all';
  const orderNum = orderNumber.toString();
  
  if (orderNum.toLowerCase().startsWith('sh')) return 'shopify';
  if (orderNum.startsWith('#')) return 'reprally';
  if (/^\d{4,5}$/.test(orderNum)) return 'fishbowl';
  
  return 'all';
}
