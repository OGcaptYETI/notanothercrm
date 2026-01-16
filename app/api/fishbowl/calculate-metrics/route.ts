import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { updateProgress, resetProgress } from '../calculate-metrics-progress/route';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {

    console.log('🔄 Starting metrics calculation...');

    // CRITICAL: Get only ACTIVE customers from copper_companies collection
    // Active Customer cf_712751 is a BOOLEAN field (true/false), not a string
    const copperCompaniesSnapshot = await adminDb
      .collection('copper_companies')
      .where('Active Customer cf_712751', '==', true)
      .get();

    console.log(`📊 Found ${copperCompaniesSnapshot.size} ACTIVE Copper companies`);

    // Build a Map of active Copper companies by Account ID cf_713477
    // fishbowl_customers.accountId matches copper_companies 'Account ID cf_713477'
    const activeCopperByAccountId = new Map<string, any>();
    copperCompaniesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const accountId = data['Account ID cf_713477'] || doc.id;
      
      if (accountId) {
        activeCopperByAccountId.set(String(accountId), {
          docId: doc.id,
          name: data.name || data.Name,
          accountId: String(accountId),
        });
      }
    });

    console.log(`✅ Built lookup map with ${activeCopperByAccountId.size} active Copper companies by Account ID`);

    // Get fishbowl_customers that match active Copper IDs
    const customersSnapshot = await adminDb
      .collection('fishbowl_customers')
      .where('copperId', '!=', null)
      .get();

    console.log(`📊 Found ${customersSnapshot.size} fishbowl customers with Copper IDs`);

    let totalCustomers = 0;
    let updated = 0;
    let skipped = 0;
    let totalOrders = 0;

    // Initialize progress tracking
    const totalToProcess = customersSnapshot.size;
    let processed = 0;
    resetProgress();
    updateProgress(0, totalToProcess, 'Starting calculation...');

    // Process each customer (only if they're in the active set)
    let debugCount = 0;
    for (const customerDoc of customersSnapshot.docs) {
      processed++;
      
      // Update progress every 10 customers
      if (processed % 10 === 0 || processed === totalToProcess) {
        updateProgress(processed, totalToProcess, `Processing customer ${processed}/${totalToProcess}...`);
      }
      const customerId = customerDoc.id;
      const customerData = customerDoc.data();
      const accountId = String(customerData.accountId || '');

      // Match by accountId (fishbowl_customers) to Account ID cf_713477 (copper_companies)
      const copperCompany = activeCopperByAccountId.get(accountId);
      
      if (!copperCompany) {
        // Debug first 3 mismatches
        if (debugCount < 3) {
          console.log(`🔍 DEBUG: Skipping ${customerData.name} - accountId: "${accountId}" not in active Copper set`);
          debugCount++;
        }
        skipped++;
        continue;
      }

      totalCustomers++;

      try {
        // Get all line items from fishbowl_soitems (has price data)
        const lineItemsSnapshot = await adminDb
          .collection('fishbowl_soitems')
          .where('customerId', '==', customerId)
          .get();

        // Check for sample kit orders even if no regular orders
        const sampleKitSnapshot = await adminDb
          .collection('fishbowl_soitems')
          .where('customerId', '==', customerId)
          .where('productNum', '==', 'Store Sample Kit')
          .get();

        const hasSampleKit = !sampleKitSnapshot.empty;

        if (lineItemsSnapshot.empty && !hasSampleKit) {
          console.log(`⚠️  No orders found for ${customerData.name}`);
          skipped++;
          continue;
        }

        // If only sample kits, still process for sample kit tracking
        if (lineItemsSnapshot.empty && hasSampleKit) {
          // Get most recent sample kit date
          let sampleKitDate: Date | null = null;
          sampleKitSnapshot.forEach(itemDoc => {
            const item = itemDoc.data();
            let postingDate: Date;
            if (item.postingDate?.toDate) {
              postingDate = item.postingDate.toDate();
            } else if (item.postingDate) {
              postingDate = new Date(item.postingDate);
            } else {
              postingDate = new Date();
            }
            
            if (!sampleKitDate || postingDate > sampleKitDate) {
              sampleKitDate = postingDate;
            }
          });

          // Store sample kit data in staging
          await adminDb.collection('fishbowl_metrics_staging').doc(customerId).set({
            customerId,
            customerName: customerData.name,
            accountId: customerData.accountId,
            copperCompanyId: copperCompany.docId,
            copperCompanyName: copperCompany.name,
            metrics: null, // No regular orders
            sampleKitSent: true,
            sampleKitDate: sampleKitDate ? sampleKitDate.toISOString() : null,
            calculatedAt: new Date().toISOString(),
            status: 'pending',
            syncError: null,
          });

          console.log(`📦 Sample kit only for ${customerData.name}`);
          updated++;
          continue;
        }

        // Group line items by salesOrderId to calculate order totals
        const orderTotals = new Map<string, { total: number, date: Date, items: any[] }>();
        const productCounts = new Map<string, number>();

        lineItemsSnapshot.forEach(itemDoc => {
          const item = itemDoc.data();
          const salesOrderId = item.salesOrderId || item.soNumber;
          const itemTotal = item.totalPrice || 0;

          // Parse posting date
          let postingDate: Date;
          if (item.postingDate?.toDate) {
            postingDate = item.postingDate.toDate();
          } else if (item.postingDate) {
            postingDate = new Date(item.postingDate);
          } else {
            postingDate = new Date();
          }

          // Aggregate by order
          if (!orderTotals.has(salesOrderId)) {
            orderTotals.set(salesOrderId, { total: 0, date: postingDate, items: [] });
          }
          const orderData = orderTotals.get(salesOrderId)!;
          orderData.total += itemTotal;
          orderData.items.push(item);

          // Track product counts (exclude shipping)
          if (item.productNum && item.productNum !== 'Shipping') {
            const count = productCounts.get(item.productNum) || 0;
            productCounts.set(item.productNum, count + (item.quantity || 1));
          }
        });

        // Calculate metrics from aggregated orders
        let totalSpent = 0;
        let firstOrderDate: Date | null = null;
        let lastOrderDate: Date | null = null;
        const orderCount = orderTotals.size;
        
        // Check for sample kits in regular orders too
        let hasSampleKitInOrders = false;
        let latestSampleKitDate: Date | null = null;
        lineItemsSnapshot.forEach(itemDoc => {
          const item = itemDoc.data();
          if (item.productNum === 'Store Sample Kit') {
            hasSampleKitInOrders = true;
            let postingDate: Date;
            if (item.postingDate?.toDate) {
              postingDate = item.postingDate.toDate();
            } else if (item.postingDate) {
              postingDate = new Date(item.postingDate);
            } else {
              postingDate = new Date();
            }
            if (!latestSampleKitDate || postingDate > latestSampleKitDate) {
              latestSampleKitDate = postingDate;
            }
          }
        });

        orderTotals.forEach((orderData, salesOrderId) => {
          totalOrders++;
          totalSpent += orderData.total;

          if (!firstOrderDate || orderData.date < firstOrderDate) {
            firstOrderDate = orderData.date;
          }
          if (!lastOrderDate || orderData.date > lastOrderDate) {
            lastOrderDate = orderData.date;
          }
        });

        // Type assertions to help TypeScript's control flow analysis
        const finalFirstOrderDate: Date | null = firstOrderDate;
        const finalLastOrderDate: Date | null = lastOrderDate;
        const finalLatestSampleKitDate: Date | null = latestSampleKitDate;

        // Calculate derived metrics
        const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
        
        // Calculate days since last order
        let daysSinceLastOrder: number | null = null;
        if (finalLastOrderDate) {
          const now = new Date();
          const diffMs = now.getTime() - finalLastOrderDate.getTime();
          daysSinceLastOrder = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        // Get top 3 products
        const topProductsArray = Array.from(productCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([product, count]) => `${product} (${count})`);
        const topProducts = topProductsArray.join(', ');

        // Store metrics in STAGING collection for persistence
        const stagingDocId = `${copperCompany.docId}_${customerId}`;
        await adminDb
          .collection('fishbowl_metrics_staging')
          .doc(stagingDocId)
          .set({
            customerId: customerId,
            customerName: customerData.name,
            copperCompanyId: copperCompany.docId,
            copperCompanyName: copperCompany.name,
            accountId: accountId,
            metrics: {
              totalOrders: orderCount,
              totalSpent: Math.round(totalSpent * 100) / 100,
              firstOrderDate: finalFirstOrderDate?.toISOString() || null,
              lastOrderDate: finalLastOrderDate?.toISOString() || null,
              averageOrderValue: Math.round(averageOrderValue * 100) / 100,
              daysSinceLastOrder: daysSinceLastOrder,
              topProducts: topProducts,
            },
            sampleKitSent: hasSampleKitInOrders || hasSampleKit,
            sampleKitDate: finalLatestSampleKitDate?.toISOString() ?? null,
            calculatedAt: new Date().toISOString(),
            status: 'pending',
            syncedAt: null,
            syncError: null,
          });

        // Also update fishbowl_customers for backward compatibility
        await adminDb
          .collection('fishbowl_customers')
          .doc(customerId)
          .update({
            metrics: {
              totalOrders: orderCount,
              totalSpent: Math.round(totalSpent * 100) / 100,
              firstOrderDate: finalFirstOrderDate?.toISOString() || null,
              lastOrderDate: finalLastOrderDate?.toISOString() || null,
              averageOrderValue: Math.round(averageOrderValue * 100) / 100,
              daysSinceLastOrder: daysSinceLastOrder,
              topProducts: topProducts,
            },
            metricsCalculatedAt: new Date().toISOString(),
          });

        updated++;
        
        if (updated % 10 === 0) {
          console.log(`✅ Processed ${updated}/${totalCustomers} customers...`);
        }

      } catch (error: any) {
        console.error(`❌ Error processing ${customerData.name}:`, error);
        skipped++;
      }
    }

    console.log('✅ Metrics calculation complete!');
    console.log(`   Total customers: ${totalCustomers}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total orders processed: ${totalOrders}`);

    // Reset progress on completion
    resetProgress();

    return NextResponse.json({
      success: true,
      stats: {
        totalCustomers,
        updated,
        skipped,
        totalOrders,
      },
    });

  } catch (error: any) {
    console.error('❌ Error calculating metrics:', error);
    resetProgress();
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
