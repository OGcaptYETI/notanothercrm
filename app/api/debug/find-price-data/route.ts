import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Searching for price data across collections...\n');

    const results: any = {
      fishbowl_soitems: null,
      line_items_subcollection: null,
      other_collections: []
    };

    // 1. Check fishbowl_soitems collection
    console.log('Checking fishbowl_soitems collection...');
    const soitemsSnapshot = await adminDb
      .collection('fishbowl_soitems')
      .limit(5)
      .get();

    if (!soitemsSnapshot.empty) {
      const sampleItems: any[] = [];
      soitemsSnapshot.docs.forEach(doc => {
        const item = doc.data();
        const priceFields: any = {};
        
        Object.keys(item).forEach(key => {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('price') || 
              lowerKey.includes('total') || 
              lowerKey.includes('amount') || 
              lowerKey.includes('cost') ||
              lowerKey.includes('quantity')) {
            priceFields[key] = item[key];
          }
        });

        sampleItems.push({
          salesOrderId: item.salesOrderId,
          soNumber: item.soNumber,
          productNum: item.productNum,
          priceFields: priceFields,
          allFields: Object.keys(item)
        });

        console.log(`\nLine Item: ${item.productNum}`);
        console.log(`  SO Number: ${item.soNumber}`);
        console.log(`  Price fields:`, priceFields);
      });

      results.fishbowl_soitems = {
        found: true,
        count: soitemsSnapshot.size,
        sampleItems: sampleItems
      };
    } else {
      results.fishbowl_soitems = { found: false };
    }

    // 2. Check for line_items subcollection
    console.log('\nChecking for line_items subcollection...');
    const salesOrderSnapshot = await adminDb
      .collection('fishbowl_sales_orders')
      .limit(1)
      .get();

    if (!salesOrderSnapshot.empty) {
      const orderId = salesOrderSnapshot.docs[0].id;
      const lineItemsSnapshot = await adminDb
        .collection('fishbowl_sales_orders')
        .doc(orderId)
        .collection('line_items')
        .limit(5)
        .get();

      if (!lineItemsSnapshot.empty) {
        const sampleLineItems: any[] = [];
        lineItemsSnapshot.docs.forEach(doc => {
          sampleLineItems.push({
            id: doc.id,
            data: doc.data(),
            fields: Object.keys(doc.data())
          });
        });

        results.line_items_subcollection = {
          found: true,
          count: lineItemsSnapshot.size,
          sampleItems: sampleLineItems
        };
      } else {
        results.line_items_subcollection = { found: false };
      }
    }

    // 3. List all collections to find other possibilities
    console.log('\nListing all collections...');
    const collections = await adminDb.listCollections();
    const fishbowlCollections = collections
      .filter(col => col.id.toLowerCase().includes('fishbowl'))
      .map(col => col.id);

    results.other_collections = fishbowlCollections;

    console.log('\nFishbowl-related collections found:', fishbowlCollections);

    return NextResponse.json({
      success: true,
      results: results,
      recommendation: results.fishbowl_soitems?.found 
        ? "Use fishbowl_soitems collection - aggregate totalPrice by salesOrderId"
        : "Price data location not found - check other collections or import process"
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
