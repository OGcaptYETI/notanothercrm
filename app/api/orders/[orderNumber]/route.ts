import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Get order details including line items and customer info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orderNumber: string } }
) {
  try {
    const { orderNumber } = params;
    
    if (!orderNumber) {
      return NextResponse.json({ error: 'orderNumber is required' }, { status: 400 });
    }
    
    console.log(`[Order Detail] Loading order: ${orderNumber}`);
    
    // Query order by soNumber
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .where('soNumber', '==', orderNumber)
      .limit(1)
      .get();
    
    // If not in Fishbowl, try ShipStation only
    if (ordersSnapshot.empty) {
      console.log(`[Order Detail] Order ${orderNumber} not found in Fishbowl, checking ShipStation only`);
      
      const shipStationSnapshot = await adminDb.collection('shipstation_orders')
        .where('orderNumber', '==', orderNumber)
        .orderBy('lastSyncedAt', 'desc')
        .limit(1)
        .get();
      
      if (shipStationSnapshot.empty) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      
      // Build order from ShipStation data only
      const shipData = shipStationSnapshot.docs[0].data();
      const shipments = shipData.shipments || [];
      const items = shipData.items || [];
      
      // Map ShipStation items to line items format
      const lineItems = items.map((item: any) => ({
        id: item.orderItemId || item.lineItemKey || item.sku,
        product: item.name || 'Unknown Product',
        productNum: item.sku || '',
        description: item.name || '',
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
        sku: item.sku || '',
        imageUrl: item.imageUrl || null
      }));
      
      const orderTotal = lineItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
      
      const order = {
        orderNumber: shipData.orderNumber || orderNumber,
        orderDate: shipData.orderDate?.toDate?.()?.toISOString() || new Date().toISOString(),
        status: shipData.orderStatus || 'Unknown',
        total: orderTotal,
        lineItems,
        _notSyncedToFishbowl: true,
        customer: {
          name: shipData.shipTo?.name || 'Unknown Customer',
          phone: shipData.shipTo?.phone || '',
          email: shipData.customerEmail || '',
          address: {
            street1: shipData.shipTo?.street1 || '',
            street2: shipData.shipTo?.street2 || '',
            city: shipData.shipTo?.city || '',
            state: shipData.shipTo?.state || '',
            postalCode: shipData.shipTo?.postalCode || ''
          }
        },
        shipping: {
          orderStatus: shipData.orderStatus || shipData.displayStatus || '',
          shipments: shipments.map((s: any) => ({
            trackingNumber: s.trackingNumber || '',
            carrierCode: s.carrierCode || '',
            serviceCode: s.serviceCode || '',
            shipDate: s.shipDate || '',
            carrierStatus: s.carrierStatus || '',
            shipmentStatus: s.shipmentStatus || ''
          }))
        },
        navigation: {
          currentIndex: 0,
          totalOrders: 1,
          previousOrder: null,
          nextOrder: null
        }
      };
      
      console.log(`[Order Detail] Loaded ShipStation-only order ${orderNumber}`);
      return NextResponse.json(order);
    }
    
    const orderDoc = ordersSnapshot.docs[0];
    const orderData = orderDoc.data();
    
    // Get line items
    const lineItemsSnapshot = await adminDb
      .collection('fishbowl_soitems')
      .where('salesOrderId', '==', orderData.salesOrderId)
      .get();
    
    // Process line items and deduplicate
    const itemsMap = new Map<string, any>();
    
    for (const doc of lineItemsSnapshot.docs) {
      const item = doc.data();
      const productNum = item.productNum || item.product || '';
      
      // Create unique key based on product, quantity, and price to identify duplicates
      const uniqueKey = `${productNum}-${item.quantity}-${item.unitPrice}`;
      
      // Skip if we've already processed this exact item
      if (itemsMap.has(uniqueKey)) {
        console.log(`[Order Detail] Skipping duplicate item: ${uniqueKey}`);
        continue;
      }
      
      // Fetch product image from products collection
      let imageUrl = null;
      if (productNum) {
        const productSnapshot = await adminDb.collection('products')
          .where('productNum', '==', productNum)
          .limit(1)
          .get();
        
        if (!productSnapshot.empty) {
          const productData = productSnapshot.docs[0].data();
          imageUrl = productData.imageUrl || null;
        }
      }
      
      const quantity = item.quantity || 0;
      const unitPrice = item.unitPrice || 0;
      const totalPrice = quantity * unitPrice;
      
      itemsMap.set(uniqueKey, {
        id: doc.id,
        product: item.product || item.productNum || 'Unknown',
        productNum,
        description: item.description || '',
        quantity,
        unitPrice,
        totalPrice,
        sku: item.sku || item.productNum || '',
        imageUrl
      });
    }
    
    const lineItems = Array.from(itemsMap.values());
    
    // Calculate order total
    const orderTotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    
    // Get customer info from copper_companies
    let customerInfo = null;
    if (orderData.customerId) {
      const copperSnapshot = await adminDb.collection('copper_companies')
        .where('cf_698467', '==', String(orderData.customerId))
        .limit(1)
        .get();
      
      if (!copperSnapshot.empty) {
        const copperData = copperSnapshot.docs[0].data();
        const address = copperData.address || {};
        
        customerInfo = {
          id: copperSnapshot.docs[0].id,
          name: copperData.name || orderData.customerName,
          accountNumber: copperData.cf_713477 ? String(copperData.cf_713477).replace(/,/g, '') : null,
          phone: copperData.phone_numbers?.[0]?.number || '',
          email: copperData.email || '',
          address: {
            street1: address.street || '',
            street2: '',
            city: address.city || '',
            state: address.state || '',
            postalCode: address.postal_code || ''
          }
        };
      }
    }
    
    // Fallback to order data if no Copper customer found
    if (!customerInfo) {
      customerInfo = {
        name: orderData.customerName || 'Unknown Customer',
        accountNumber: orderData.customerId,
        phone: '',
        email: '',
        address: {
          street1: '',
          street2: '',
          city: '',
          state: '',
          postalCode: ''
        }
      };
    }
    
    // Get all orders for this customer for navigation
    const allOrdersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .where('customerId', '==', orderData.customerId)
      .orderBy('postingDate', 'desc')
      .get();
    
    const allOrderNumbers = allOrdersSnapshot.docs.map(doc => doc.data().soNumber);
    const currentIndex = allOrderNumbers.indexOf(orderNumber);
    
    // Get shipping/tracking info from ShipStation
    let shippingInfo = null;
    console.log(`[Order Detail] Looking for shipping data for order: ${orderNumber}`);
    
    const shipStationSnapshot = await adminDb.collection('shipstation_orders')
      .where('orderNumber', '==', orderNumber)
      .orderBy('lastSyncedAt', 'desc')
      .limit(1)
      .get();
    
    console.log(`[Order Detail] ShipStation query returned ${shipStationSnapshot.size} documents`);
    
    if (!shipStationSnapshot.empty) {
      const shipData = shipStationSnapshot.docs[0].data();
      console.log(`[Order Detail] Found shipstation data:`, {
        orderNumber: shipData.orderNumber,
        shipmentsCount: shipData.shipments?.length || 0,
        orderStatus: shipData.orderStatus
      });
      
      const shipments = shipData.shipments || [];
      
      shippingInfo = {
        orderStatus: shipData.orderStatus || shipData.displayStatus || '',
        shipments: shipments.map((s: any) => ({
          trackingNumber: s.trackingNumber || '',
          carrierCode: s.carrierCode || '',
          serviceCode: s.serviceCode || '',
          shipDate: s.shipDate || '',
          carrierStatus: s.carrierStatus || '',
          shipmentStatus: s.shipmentStatus || ''
        }))
      };
      
      console.log(`[Order Detail] Returning ${shipments.length} shipments with status: ${shippingInfo.orderStatus}`);
    } else {
      console.log(`[Order Detail] No shipstation_orders document found for order ${orderNumber}`);
    }
    
    const order = {
      orderNumber: orderData.soNumber || orderNumber,
      salesOrderId: orderData.salesOrderId,
      orderDate: orderData.postingDate?.toDate?.()?.toISOString() || orderData.dateCreated?.toDate?.()?.toISOString(),
      status: orderData.status || 'Completed',
      customerId: orderData.customerId,
      customerName: orderData.customerName,
      salesPerson: orderData.salesPerson || '',
      accountType: orderData.accountType || '',
      total: orderTotal,
      lineItems,
      customer: customerInfo,
      shipping: shippingInfo,
      navigation: {
        currentIndex,
        totalOrders: allOrderNumbers.length,
        previousOrder: currentIndex < allOrderNumbers.length - 1 ? allOrderNumbers[currentIndex + 1] : null,
        nextOrder: currentIndex > 0 ? allOrderNumbers[currentIndex - 1] : null
      }
    };
    
    console.log(`[Order Detail] Loaded order ${orderNumber} with ${lineItems.length} line items`);
    
    return NextResponse.json(order);
    
  } catch (error: any) {
    console.error('[Order Detail] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to load order details' 
    }, { status: 500 });
  }
}
