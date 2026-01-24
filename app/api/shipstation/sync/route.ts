/**
 * ShipStation Sync API
 * Manually triggers a sync of ShipStation orders to Firestore cache
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

const SHIPSTATION_API_BASE = 'https://ssapi.shipstation.com';
const SHIPSTATION_API_V2_BASE = 'https://api.shipstation.com';

async function fetchShipStationV1(path: string, params?: URLSearchParams) {
  const apiKey = process.env.SHIPSTATION_API_KEY;
  const apiSecret = process.env.SHIPSTATION_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('ShipStation API credentials not configured');
  }

  const url = `${SHIPSTATION_API_BASE}${path}${params ? `?${params.toString()}` : ''}`;
  const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`ShipStation API error: ${response.status} ${text}`);
  }

  return response.json();
}

async function fetchShipStationV2(path: string, params?: URLSearchParams) {
  const apiKeyV2 = process.env.SHIPSTATION_API_KEY_V2;

  if (!apiKeyV2) {
    throw new Error('ShipStation v2 API key not configured');
  }

  const url = `${SHIPSTATION_API_V2_BASE}${path}${params ? `?${params.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'API-Key': apiKeyV2,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`ShipStation v2 API error: ${response.status} ${text}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  if (!adminDb) {
    return NextResponse.json(
      { error: 'Firebase Admin not initialized' },
      { status: 500 }
    );
  }

  const now = new Date();
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  try {
    // Update sync meta to running
    await adminDb.collection('shipstation_sync_meta').doc('lastSync').set({
      lastRunAt: Timestamp.fromDate(now),
      status: 'running',
      ordersProcessed: 0
    }, { merge: true });

    // 1. Fetch orders from ShipStation API (last 15 days)
    const ordersParams = new URLSearchParams({
      createDateStart: fifteenDaysAgo.toISOString(),
      createDateEnd: now.toISOString(),
      pageSize: '500',
      page: '1'
    });

    let allOrders: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      ordersParams.set('page', String(page));
      const ordersData = await fetchShipStationV1('/orders', ordersParams);
      allOrders = [...allOrders, ...(ordersData.orders || [])];
      
      hasMore = page < (ordersData.pages || 1);
      page++;
      
      // Safety limit
      if (page > 20) break;
    }

    // 2. Fetch shipments for tracking numbers
    const shipmentsParams = new URLSearchParams({
      shipDateStart: fifteenDaysAgo.toISOString(),
      shipDateEnd: now.toISOString(),
      pageSize: '500'
    });
    
    const shipmentsData = await fetchShipStationV1('/shipments', shipmentsParams);
    const shipments = shipmentsData.shipments || [];

    // Build shipments map
    const shipmentsMap: Record<string | number, any[]> = {};
    for (const s of shipments) {
      const key = s.orderId || s.orderNumber;
      if (key) {
        if (!shipmentsMap[key]) shipmentsMap[key] = [];
        shipmentsMap[key].push(s);
      }
      if (s.orderNumber && s.orderNumber !== key) {
        if (!shipmentsMap[s.orderNumber]) shipmentsMap[s.orderNumber] = [];
        shipmentsMap[s.orderNumber].push(s);
      }
    }

    // 3. Fetch labels for tracking status (paginate through all)
    let trackingStatusMap: Record<string, any> = {};
    try {
      let labelsPage = 1;
      let hasMoreLabels = true;
      
      while (hasMoreLabels && labelsPage <= 10) {
        const labelsParams = new URLSearchParams({
          ship_date_start: fifteenDaysAgo.toISOString(),
          ship_date_end: now.toISOString(),
          page: String(labelsPage),
          page_size: '200'
        });
        const labelsData = await fetchShipStationV2('/v2/labels', labelsParams);
        
        for (const label of labelsData.labels || []) {
          if (label.tracking_number && label.tracking_status) {
            trackingStatusMap[label.tracking_number] = {
              status: label.tracking_status,
              shipDate: label.ship_date,
              labelId: label.label_id
            };
          }
        }
        
        hasMoreLabels = labelsData.has_next_page || false;
        labelsPage++;
      }
    } catch (err) {
      console.warn('Could not fetch labels:', err);
    }

    // 4. Batch write to Firestore
    let batch = adminDb.batch();
    let ordersProcessed = 0;
    let batchCount = 0;

    for (const order of allOrders) {
      const orderRef = adminDb.collection('shipstation_orders').doc(String(order.orderId));
      
      // Enrich with shipment data
      const matchedShipments = shipmentsMap[order.orderId] || shipmentsMap[order.orderNumber] || [];
      const enrichedShipments = matchedShipments.map((s: any) => {
        const labelTracking = trackingStatusMap[s.trackingNumber];
        return {
          shipmentId: s.shipmentId,
          carrierCode: s.carrierCode || '',
          trackingNumber: s.trackingNumber || '',
          shipDate: labelTracking?.shipDate || s.shipDate,
          serviceCode: s.serviceCode || '',
          carrierStatus: labelTracking?.status || null
        };
      });

      // Determine display status - check all shipments for best status
      let displayStatus = order.orderStatus;
      for (const shipment of enrichedShipments) {
        if (shipment.carrierStatus) {
          displayStatus = shipment.carrierStatus;
          break; // Use first non-null carrierStatus
        }
      }

      batch.set(orderRef, {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        orderDate: Timestamp.fromDate(new Date(order.orderDate || order.createDate)),
        orderStatus: order.orderStatus,
        customerEmail: order.customerEmail || null,
        billTo: order.billTo || {},
        shipTo: order.shipTo || {},
        items: order.items || [],
        orderTotal: order.orderTotal || 0,
        amountPaid: order.amountPaid || 0,
        taxAmount: order.taxAmount || 0,
        shippingAmount: order.shippingAmount || 0,
        customerNotes: order.customerNotes || null,
        internalNotes: order.internalNotes || null,
        shipments: enrichedShipments,
        displayStatus,
        lastSyncedAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt)
      }, { merge: true });

      ordersProcessed++;
      batchCount++;

      // Commit in batches of 400 and create new batch
      if (batchCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    // Final commit if there are remaining items
    if (batchCount > 0) {
      await batch.commit();
    }

    // 5. Delete orders older than 15 days (TTL cleanup)
    const oldOrdersQuery = adminDb.collection('shipstation_orders')
      .where('expiresAt', '<', Timestamp.fromDate(now));
    
    const oldOrdersSnapshot = await oldOrdersQuery.get();
    const deleteBatch = adminDb.batch();
    let deletedCount = 0;
    
    oldOrdersSnapshot.docs.forEach((doc) => {
      deleteBatch.delete(doc.ref);
      deletedCount++;
    });
    
    if (deletedCount > 0) {
      await deleteBatch.commit();
    }

    // Update sync meta
    await adminDb.collection('shipstation_sync_meta').doc('lastSync').set({
      lastRunAt: Timestamp.fromDate(now),
      ordersProcessed,
      deletedCount,
      status: 'success'
    });

    return NextResponse.json({
      success: true,
      message: `Synced ${ordersProcessed} orders, deleted ${deletedCount} expired`,
      ordersProcessed,
      deletedCount
    });
  } catch (error) {
    console.error('ShipStation sync error:', error);

    // Update sync meta with error
    await adminDb.collection('shipstation_sync_meta').doc('lastSync').set({
      lastRunAt: Timestamp.fromDate(now),
      status: 'error',
      errorMessage: String(error)
    }, { merge: true });

    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
