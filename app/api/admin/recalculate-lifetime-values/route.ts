import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Recalculate lifetime values from sales_order_history subcollections
 * Fixes: Customers showing $0.00 despite having orders
 */
export async function POST() {
  try {
    console.log('\n💰 STARTING LIFETIME VALUE RECALCULATION');
    console.log('=' .repeat(80));
    
    const stats = {
      customersProcessed: 0,
      customersUpdated: 0,
      customersWithOrders: 0,
      customersWithoutOrders: 0,
      totalRevenueCalculated: 0,
      errors: [] as string[]
    };

    // Get all customers
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    console.log(`📦 Found ${customersSnapshot.size} customers to process\n`);

    const batch = adminDb.batch();
    let batchCount = 0;

    for (const customerDoc of customersSnapshot.docs) {
      const customerId = customerDoc.id;
      const customerData = customerDoc.data();
      stats.customersProcessed++;

      try {
        // Get sales_order_history subcollection
        const ordersSnapshot = await adminDb
          .collection('fishbowl_customers')
          .doc(customerId)
          .collection('sales_order_history')
          .get();

        if (ordersSnapshot.empty) {
          stats.customersWithoutOrders++;
          
          // Set to 0 if no orders
          batch.update(customerDoc.ref, {
            totalSales: 0,
            totalOrders: 0,
            lastOrderDate: null,
            firstOrderDate: null
          });
          
          batchCount++;
        } else {
          stats.customersWithOrders++;
          
          // Calculate from subcollection
          let totalSales = 0;
          let firstOrderDate: Date | null = null;
          let lastOrderDate: Date | null = null;

          for (const orderDoc of ordersSnapshot.docs) {
            const orderData = orderDoc.data();
            const orderTotal = Number(orderData.total || orderData.orderTotal || 0);
            totalSales += orderTotal;

            // Track dates
            const orderDate = orderData.postingDate?.toDate?.() || 
                            orderData.orderDate?.toDate?.() ||
                            new Date(orderData.postingDate || orderData.orderDate);
            
            if (orderDate && !isNaN(orderDate.getTime())) {
              if (!firstOrderDate || orderDate < firstOrderDate) {
                firstOrderDate = orderDate;
              }
              if (!lastOrderDate || orderDate > lastOrderDate) {
                lastOrderDate = orderDate;
              }
            }
          }

          stats.totalRevenueCalculated += totalSales;

          // Update customer document
          batch.update(customerDoc.ref, {
            totalSales,
            totalOrders: ordersSnapshot.size,
            lastOrderDate: lastOrderDate || null,
            firstOrderDate: firstOrderDate || null,
            updatedAt: new Date()
          });

          stats.customersUpdated++;
          batchCount++;

          if (totalSales > 0) {
            console.log(`  ✅ ${customerData.name || customerId}: ${ordersSnapshot.size} orders, $${totalSales.toFixed(2)}`);
          }
        }

        // Commit batch every 400 operations
        if (batchCount >= 400) {
          await batch.commit();
          console.log(`  📝 Committed batch (${batchCount} updates)`);
          batchCount = 0;
        }

      } catch (error: any) {
        console.error(`  ❌ Error processing ${customerId}:`, error.message);
        stats.errors.push(`${customerId}: ${error.message}`);
      }
    }

    // Final commit
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  📝 Final commit (${batchCount} updates)`);
    }

    // SUMMARY
    console.log('\n' + '='.repeat(80));
    console.log('✅ LIFETIME VALUE RECALCULATION COMPLETE');
    console.log('='.repeat(80));
    console.log(`Customers Processed:        ${stats.customersProcessed.toLocaleString()}`);
    console.log(`Customers Updated:          ${stats.customersUpdated.toLocaleString()}`);
    console.log(`Customers With Orders:      ${stats.customersWithOrders.toLocaleString()}`);
    console.log(`Customers Without Orders:   ${stats.customersWithoutOrders.toLocaleString()}`);
    console.log(`Total Revenue Calculated:   $${stats.totalRevenueCalculated.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
    console.log(`Errors:                     ${stats.errors.length}`);
    console.log('='.repeat(80) + '\n');

    if (stats.errors.length > 0) {
      console.log('❌ Errors encountered:');
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }

    return NextResponse.json({
      success: true,
      stats,
      message: `Updated ${stats.customersUpdated} customers with lifetime values`
    });

  } catch (error: any) {
    console.error('❌ Recalculation error:', error);
    return NextResponse.json(
      { error: error.message || 'Recalculation failed' },
      { status: 500 }
    );
  }
}
