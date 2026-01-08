import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { dataType } = await request.json();

    if (!dataType || !['tiers', 'shipping', 'all'].includes(dataType)) {
      return NextResponse.json(
        { error: 'Invalid dataType. Must be "tiers", "shipping", or "all"' },
        { status: 400 }
      );
    }

    const results: any = {
      success: true,
      migrated: [],
      errors: []
    };

    // Migrate Tiers
    if (dataType === 'tiers' || dataType === 'all') {
      try {
        const tiersPath = path.join(process.cwd(), 'public', 'quotes', 'data', 'tiers.json');
        const tiersData = JSON.parse(fs.readFileSync(tiersPath, 'utf-8'));
        
        const tiersCollection = adminDb.collection('pricing_tiers');
        
        for (const [key, tier] of Object.entries(tiersData)) {
          const tierData: any = tier;
          await tiersCollection.doc(key).set({
            tierId: tierData.tierId,
            threshold: tierData.threshold,
            name: tierData.name,
            description: tierData.description,
            margin: tierData.margin,
            prices: tierData.prices,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
        
        results.migrated.push('tiers');
      } catch (error: any) {
        results.errors.push({ type: 'tiers', error: error.message });
      }
    }

    // Migrate Shipping
    if (dataType === 'shipping' || dataType === 'all') {
      try {
        const shippingPath = path.join(process.cwd(), 'public', 'quotes', 'data', 'shipping.json');
        const shippingData = JSON.parse(fs.readFileSync(shippingPath, 'utf-8'));
        
        // Store shipping configuration as a single document
        const shippingDoc = adminDb.collection('shipping_config').doc('default');
        await shippingDoc.set({
          ...shippingData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        // Also store individual zones for easier querying
        if (shippingData.zones) {
          const zonesCollection = adminDb.collection('shipping_zones');
          for (const [zoneKey, zoneData] of Object.entries(shippingData.zones)) {
            await zonesCollection.doc(zoneKey).set({
              ...zoneData as any,
              zoneId: zoneKey,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
        
        results.migrated.push('shipping');
      } catch (error: any) {
        results.errors.push({ type: 'shipping', error: error.message });
      }
    }

    if (results.errors.length > 0) {
      results.success = false;
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    );
  }
}
