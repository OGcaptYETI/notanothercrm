/**
 * Cached ShipStation Orders API
 * Reads from Firestore cache instead of hitting ShipStation API
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  if (!adminDb) {
    return NextResponse.json(
      { error: 'Firebase Admin not initialized' },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '100');

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'start and end dates are required' },
      { status: 400 }
    );
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Query Firestore for orders in date range
    const ordersSnapshot = await adminDb
      .collection('shipstation_orders')
      .where('orderDate', '>=', start)
      .where('orderDate', '<=', end)
      .orderBy('orderDate', 'desc')
      .get();

    const allOrders: any[] = [];

    for (const doc of ordersSnapshot.docs) {
      const data = doc.data();
      
      // Convert Firestore timestamps to ISO strings
      const orderDate = data.orderDate?.toDate?.() || new Date(data.orderDate);
      
      allOrders.push({
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        orderDate: orderDate.toISOString(),
        orderStatus: data.orderStatus || data.displayStatus || '',
        customerEmail: data.customerEmail || '',
        billTo: data.billTo || { name: '', street1: '', city: '', state: '', postalCode: '' },
        shipTo: data.shipTo || { name: '', street1: '', city: '', state: '', postalCode: '' },
        items: data.items || [],
        orderTotal: data.orderTotal || 0,
        amountPaid: data.amountPaid,
        taxAmount: data.taxAmount,
        shippingAmount: data.shippingAmount,
        shipments: data.shipments || [],
        carrierCode: data.carrierCode,
        _displayStatus: data.displayStatus,
        _customerId: data._customerId
      });
    }

    // Calculate pagination
    const total = allOrders.length;
    const pages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedOrders = allOrders.slice(startIndex, endIndex);

    return NextResponse.json({
      orders: paginatedOrders,
      total,
      page,
      pages
    });
  } catch (error: any) {
    console.error('Error fetching from Firestore:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
