/**
 * ShipStation Sync Cloud Function
 * Syncs orders from ShipStation API to Firestore cache hourly
 */
"use strict";

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {Timestamp} = require("firebase-admin/firestore");
const admin = require("firebase-admin");

const SHIPSTATION_API_BASE = "https://ssapi.shipstation.com";
const SHIPSTATION_API_V2_BASE = "https://api.shipstation.com";
const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET;

const SHIPSTATION_API_KEY_V2 = process.env.SHIPSTATION_API_KEY_V2;

/**
 * Fetches data from ShipStation v1 API
 * @param {string} path - API endpoint path
 * @param {URLSearchParams} params - Query parameters
 * @return {Promise<Object>} API response data
 */
async function fetchShipStationV1(path, params) {
  const authHeader = "Basic " +
        Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`)
            .toString("base64");

  const url = `${SHIPSTATION_API_BASE}${path}?${params.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ShipStation API error: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * Fetches data from ShipStation v2 API
 * @param {string} path - API endpoint path
 * @param {URLSearchParams} params - Query parameters
 * @return {Promise<Object>} API response data
 */
async function fetchShipStationV2(path, params) {
  const url = `${SHIPSTATION_API_V2_BASE}${path}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "API-Key": SHIPSTATION_API_KEY_V2,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ShipStation v2 API error: ${response.status} ${text}`);
  }

  return response.json();
}

exports.syncShipStationOrders = onSchedule(
    {
      schedule: "every 30 minutes",
      timeoutSeconds: 540,
      memory: "1GiB",
    },
    async () => {
      const db = admin.firestore();
      const now = new Date();
      const fourteenDaysAgo = new Date(
          now.getTime() - 14 * 24 * 60 * 60 * 1000,
      );
      const expiresAt = new Date(
          now.getTime() + 15 * 24 * 60 * 60 * 1000,
      );

      try {
        await db.collection("shipstation_sync_meta").doc("lastSync").set({
          lastRunAt: Timestamp.fromDate(now),
          status: "running",
          ordersProcessed: 0,
        }, {merge: true});

        const ordersParams = new URLSearchParams({
          createDateStart: fourteenDaysAgo.toISOString(),
          createDateEnd: now.toISOString(),
          pageSize: "500",
          page: "1",
        });

        let allOrders = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          ordersParams.set("page", String(page));
          const ordersData = await fetchShipStationV1(
              "/orders",
              ordersParams,
          );
          allOrders = [...allOrders, ...(ordersData.orders || [])];

          hasMore = page < (ordersData.pages || 1);
          page++;

          if (page > 20) break;
        }

        const shipmentsParams = new URLSearchParams({
          shipDateStart: fourteenDaysAgo.toISOString(),
          shipDateEnd: now.toISOString(),
          pageSize: "500",
        });

        const shipmentsData = await fetchShipStationV1(
            "/shipments",
            shipmentsParams,
        );
        const shipments = shipmentsData.shipments || [];

        const shipmentsMap = {};
        for (const s of shipments) {
          const key = s.orderId || s.orderNumber;
          if (key) {
            if (!shipmentsMap[key]) shipmentsMap[key] = [];
            shipmentsMap[key].push(s);
          }
          if (s.orderNumber && s.orderNumber !== key) {
            if (!shipmentsMap[s.orderNumber]) {
              shipmentsMap[s.orderNumber] = [];
            }
            shipmentsMap[s.orderNumber].push(s);
          }
        }

        const trackingStatusMap = {};
        try {
          let labelsPage = 1;
          let hasMoreLabels = true;

          while (hasMoreLabels && labelsPage <= 10) {
            const labelsParams = new URLSearchParams({
              ship_date_start: fourteenDaysAgo.toISOString(),
              ship_date_end: now.toISOString(),
              page: String(labelsPage),
              page_size: "200",
            });
            const labelsData = await fetchShipStationV2(
                "/v2/labels",
                labelsParams,
            );

            for (const label of labelsData.labels || []) {
              if (label.tracking_number && label.tracking_status) {
                trackingStatusMap[label.tracking_number] = {
                  status: label.tracking_status,
                  shipDate: label.ship_date,
                  labelId: label.label_id,
                };
              }
            }

            hasMoreLabels = labelsData.has_next_page || false;
            labelsPage++;
          }
        } catch (err) {
          console.warn("Could not fetch labels:", err);
        }

        let batch = db.batch();
        let ordersProcessed = 0;
        let batchCount = 0;

        for (const order of allOrders) {
          const orderRef = db.collection("shipstation_orders")
              .doc(String(order.orderId));

          const matchedShipments = shipmentsMap[order.orderId] ||
                    shipmentsMap[order.orderNumber] || [];
          const enrichedShipments = matchedShipments.map((s) => {
            const labelTracking = trackingStatusMap[s.trackingNumber];
            return {
              shipmentId: s.shipmentId,
              carrierCode: s.carrierCode || "",
              trackingNumber: s.trackingNumber || "",
              shipDate: labelTracking?.shipDate || s.shipDate,
              serviceCode: s.serviceCode || "",
              carrierStatus: labelTracking?.status || null,
            };
          });

          let displayStatus = order.orderStatus;
          for (const shipment of enrichedShipments) {
            if (shipment.carrierStatus) {
              displayStatus = shipment.carrierStatus;
              break;
            }
          }

          batch.set(orderRef, {
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            orderDate: Timestamp.fromDate(
                new Date(order.orderDate || order.createDate),
            ),
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
            expiresAt: Timestamp.fromDate(expiresAt),
          }, {merge: true});

          ordersProcessed++;
          batchCount++;

          if (batchCount >= 400) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        const oldOrdersQuery = db.collection("shipstation_orders")
            .where("expiresAt", "<", Timestamp.fromDate(now));

        const oldOrdersSnapshot = await oldOrdersQuery.get();
        let deleteBatch = db.batch();
        let deletedCount = 0;
        let deleteBatchCount = 0;

        oldOrdersSnapshot.docs.forEach((doc) => {
          deleteBatch.delete(doc.ref);
          deletedCount++;
          deleteBatchCount++;

          if (deleteBatchCount >= 400) {
            deleteBatch.commit();
            deleteBatch = db.batch();
            deleteBatchCount = 0;
          }
        });

        if (deleteBatchCount > 0) {
          await deleteBatch.commit();
        }

        await db.collection("shipstation_sync_meta").doc("lastSync").set({
          lastRunAt: Timestamp.fromDate(now),
          ordersProcessed,
          deletedCount,
          status: "success",
        });

        console.log(
            `ShipStation sync: ${ordersProcessed} orders, ` +
                `${deletedCount} deleted`,
        );
      } catch (error) {
        console.error("ShipStation sync error:", error);

        await db.collection("shipstation_sync_meta").doc("lastSync").set({
          lastRunAt: Timestamp.fromDate(now),
          status: "error",
          errorMessage: String(error),
        }, {merge: true});
      }
    },
);
