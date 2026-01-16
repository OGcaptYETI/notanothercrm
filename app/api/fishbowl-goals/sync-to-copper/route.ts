import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { updateSyncProgress, resetSyncProgress } from '../sync-progress/route';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting sync to Copper...');

    // Get customers from STAGING collection (has correct copperCompanyId)
    const stagingSnapshot = await adminDb
      .collection('fishbowl_metrics_staging')
      .where('status', '==', 'pending')
      .get();

    const customers = stagingSnapshot.docs.map(doc => ({
      stagingId: doc.id,
      ...doc.data()
    })) as any[];

    console.log(`📊 Found ${customers.length} customers in staging ready to sync`);

    // Initialize progress
    updateSyncProgress(0, customers.length, 'Starting sync to Copper...');

    // Get Copper API credentials from env
    const copperApiKey = process.env.COPPER_API_KEY;
    const copperEmail = process.env.COPPER_USER_EMAIL;

    if (!copperApiKey || !copperEmail) {
      throw new Error('Copper API credentials not configured');
    }

    let synced = 0;
    let failed = 0;

    console.log(`🔄 Starting sync for ${customers.length} customers...`);

    // Sync each customer to Copper
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      
      // Update progress
      updateSyncProgress(i + 1, customers.length, `Syncing ${customer.customerName}...`);
      try {
        const metrics = customer.metrics;
        
        if (!metrics) {
          console.log(`⚠️  Skipping ${customer.customerName} - no metrics`);
          failed++;
          continue;
        }

        // Use copperCompanyId from staging (this is the Firestore doc ID)
        const copperCompanyId = customer.copperCompanyId;
        if (!copperCompanyId) {
          console.log(`⚠️  Skipping ${customer.customerName} - no Copper company ID`);
          failed++;
          continue;
        }

        // Get the actual Copper ID from copper_companies collection
        const copperDoc = await adminDb
          .collection('copper_companies')
          .doc(copperCompanyId)
          .get();

        if (!copperDoc.exists) {
          const errorMsg = `Copper company not found in Firestore: ${copperCompanyId}`;
          console.log(`⚠️  Skipping ${customer.customerName} - ${errorMsg}`);
          
          // Update staging with error
          await adminDb.collection('fishbowl_metrics_staging').doc(customer.stagingId).update({
            status: 'error',
            syncError: errorMsg,
          });
          
          failed++;
          continue;
        }

        const copperData = copperDoc.data();
        const copperId = copperData?.id || copperData?.['Copper ID'];
        
        if (!copperId || isNaN(Number(copperId))) {
          const errorMsg = `Invalid Copper ID in Firestore doc: ${copperId}`;
          console.log(`⚠️  Skipping ${customer.customerName} - ${errorMsg}`);
          
          // Update staging with error
          await adminDb.collection('fishbowl_metrics_staging').doc(customer.stagingId).update({
            status: 'error',
            syncError: errorMsg,
          });
          
          failed++;
          continue;
        }

        // Map metrics to Copper custom field IDs
        const custom_fields = [
          // Auto-activate customer if they have Fishbowl data (boolean true, not 'checked')
          { custom_field_definition_id: 712751, value: true }, // Active Customer
          { custom_field_definition_id: 698403, value: metrics.totalOrders },
          { custom_field_definition_id: 698404, value: metrics.totalSpent },
          { custom_field_definition_id: 698407, value: metrics.averageOrderValue },
        ];

        // Add dates if they exist - Convert ISO to Unix timestamp (seconds)
        if (metrics.firstOrderDate) {
          const firstOrderTimestamp = Math.floor(new Date(metrics.firstOrderDate).getTime() / 1000);
          custom_fields.push({ custom_field_definition_id: 698405, value: firstOrderTimestamp });
        }
        if (metrics.lastOrderDate) {
          const lastOrderTimestamp = Math.floor(new Date(metrics.lastOrderDate).getTime() / 1000);
          custom_fields.push({ custom_field_definition_id: 698406, value: lastOrderTimestamp });
        }

        // Add new fields: Days Since Last Order and Top Products
        if (metrics.daysSinceLastOrder !== null && metrics.daysSinceLastOrder !== undefined) {
          custom_fields.push({ custom_field_definition_id: 713846, value: metrics.daysSinceLastOrder });
        }
        if (metrics.topProducts) {
          custom_fields.push({ custom_field_definition_id: 713845, value: metrics.topProducts });
        }

        // Add Sample Kit fields
        if (customer.sampleKitSent) {
          custom_fields.push({ custom_field_definition_id: 727201, value: true }); // Sample Kit Sent
        }
        if (customer.sampleKitDate) {
          const sampleKitTimestamp = Math.floor(new Date(customer.sampleKitDate).getTime() / 1000);
          custom_fields.push({ custom_field_definition_id: 727202, value: sampleKitTimestamp }); // Sample Kit Date
        }

        // Call Copper API to update company
        const response = await fetch(`https://api.copper.com/developer_api/v1/companies/${copperId}`, {
          method: 'PUT',
          headers: {
            'X-PW-AccessToken': copperApiKey,
            'X-PW-Application': 'developer_api',
            'X-PW-UserEmail': copperEmail,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            custom_fields,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const errorMsg = `Copper API error: ${response.status} - ${errorText}`;
          
          // Log which Copper ID was used
          console.error(`❌ Failed to sync ${customer.customerName}: ${errorMsg}`);
          console.error(`   Copper ID used: ${copperId}`);
          console.error(`   Firestore doc ID: ${copperCompanyId}`);
          
          // Update staging with error
          await adminDb.collection('fishbowl_metrics_staging').doc(customer.stagingId).update({
            status: 'error',
            syncError: errorMsg,
          });
          
          failed++;
          continue;
        }

        // Update staging with success
        await adminDb.collection('fishbowl_metrics_staging').doc(customer.stagingId).update({
          status: 'synced',
          syncedAt: new Date().toISOString(),
          syncError: null,
        });

        // Also update fishbowl_customers for backward compatibility
        if (customer.customerId) {
          await adminDb.collection('fishbowl_customers').doc(customer.customerId).update({
            syncedToCopperAt: new Date().toISOString(),
          });
        }

        synced++;
        console.log(`✅ Synced ${customer.customerName} (${synced}/${customers.length})`);

      } catch (error: any) {
        console.error(`❌ Failed to sync ${customer.customerName}:`, error.message);
        
        // Update staging with error
        await adminDb.collection('fishbowl_metrics_staging').doc(customer.stagingId).update({
          status: 'error',
          syncError: error.message,
        });
        
        failed++;
      }
    }

    console.log(`✅ Sync complete! Synced: ${synced}, Failed: ${failed}`);

    // Reset progress
    resetSyncProgress();

    return NextResponse.json({
      success: true,
      stats: {
        total: customers.length,
        synced,
        failed,
      },
    });

  } catch (error: any) {
    console.error('❌ Error syncing to Copper:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
