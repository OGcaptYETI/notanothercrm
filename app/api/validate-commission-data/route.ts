import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ValidationWarning {
  type: 'unmatchedRep' | 'missingCustomer' | 'inactiveRep' | 'missingRate' | 'dataQuality' | 'orphanedOrders' | 'retailExcluded' | 'customerNotFound';
  severity: 'error' | 'warning' | 'info';
  count: number;
  message: string;
  details?: string[];
  orderNumbers?: string[];
  totalRevenue?: number;
  affectedReps?: string[];
}

interface RepBreakdown {
  repName: string;
  repId: string;
  orderCount: number;
  estimatedRevenue: number;
  status: 'active' | 'inactive';
  warnings: string[];
}

interface FieldMapping {
  detected: Record<string, string[]>;
  suggested: Record<string, string>;
  conflicts: string[];
}

interface ExcludedOrder {
  orderNum: string;
  customerName: string;
  customerId?: string;
  accountType?: string;
  revenue: number;
  salesPerson: string;
}

export async function POST(req: NextRequest) {
  try {
    const { commissionMonth, salesPerson } = await req.json();
    
    if (!commissionMonth) {
      return NextResponse.json({ error: 'commissionMonth is required' }, { status: 400 });
    }
    
    console.log(`\n🔍 VALIDATING COMMISSION DATA FOR: ${commissionMonth}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Load all necessary data
    const [ordersSnapshot, usersSnapshot, customersSnapshot, ratesSnapshot] = await Promise.all([
      adminDb.collection('fishbowl_sales_orders')
        .where('commissionMonth', '==', commissionMonth)
        .get(),
      adminDb.collection('users')
        .where('isCommissioned', '==', true)
        .get(),
      adminDb.collection('fishbowl_customers').get(),
      adminDb.collection('commission_rates').get()
    ]);
    
    console.log(`📊 Loaded: ${ordersSnapshot.size} orders, ${usersSnapshot.size} reps, ${customersSnapshot.size} customers`);
    
    // Build maps
    const repsMap = new Map();
    const repsByName = new Map();
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      repsMap.set(data.salesPerson, { id: doc.id, ...data });
      if (data.name) {
        repsByName.set(data.name, { id: doc.id, ...data });
        const firstName = data.name.split(' ')[0];
        if (!repsByName.has(firstName)) {
          repsByName.set(firstName, { id: doc.id, ...data });
        }
      }
    });
    
    // Debug: Show available rep mappings
    console.log('\n🔍 DEBUG: Available rep mappings:');
    console.log('  By salesPerson:', Array.from(repsMap.keys()));
    console.log('  By name:', Array.from(repsByName.keys()));
    
    // Debug: Show first 5 order salesPerson values
    console.log('\n🔍 DEBUG: First 5 order salesPerson values:');
    ordersSnapshot.docs.slice(0, 5).forEach(doc => {
      const order = doc.data();
      console.log(`  Order ${order.soNumber}: salesPerson="${order.salesPerson}"`);
    });
    
    const customersMap = new Map();
    customersSnapshot.forEach(doc => {
      const data = doc.data();
      customersMap.set(data.customerId, data);
      if (data.customerNum) customersMap.set(data.customerNum, data);
      if (data.accountNumber) customersMap.set(data.accountNumber, data);
    });
    
    // Analyze orders
    const warnings: ValidationWarning[] = [];
    const repBreakdown = new Map<string, RepBreakdown>();
    const unmatchedReps = new Set<string>();
    const missingCustomers: string[] = [];
    const adminOrders: string[] = [];
    const retailExcludedOrders: ExcludedOrder[] = [];
    const customerNotFoundOrders: ExcludedOrder[] = [];
    const orphanedOrdersBySalesPerson = new Map<string, {orders: number, revenue: number}>();
    
    let totalOrders = 0;
    let matchedOrders = 0;
    let totalRevenue = 0;

    // HARD FAIL DATA QUALITY: Detect schema drift symptoms
    // If totalPrice is 0 but unitPrice × quantity > 0, it means the import/mapping is broken.
    let suspiciousLineItems = 0;
    const suspiciousSamples: string[] = [];
    
    // Detect field variations in orders
    const fieldVariations = {
      salesPerson: new Set<string>(),
      orderNumber: new Set<string>(),
      customerId: new Set<string>()
    };
    
    for (const orderDoc of ordersSnapshot.docs) {
      const order = orderDoc.data();
      totalOrders++;
      
      // Detect field names
      // CRITICAL: Only salesPerson is used for commission calculation (salesRep is for reporting only)
      if (order.salesPerson !== undefined) fieldVariations.salesPerson.add('salesPerson');
      // Note: salesRep is stored but NOT used in calculations - don't flag as conflict
      // if (order.salesRep !== undefined) fieldVariations.salesPerson.add('salesRep');
      if (order.soNumber !== undefined) fieldVariations.orderNumber.add('soNumber');
      if (order.num !== undefined) fieldVariations.orderNumber.add('num');
      if (order.customerId !== undefined) fieldVariations.customerId.add('customerId');
      if (order.customerNum !== undefined) fieldVariations.customerId.add('customerNum');

      // Calculate revenue from line items for EVERY order (including admin).
      // This keeps the validation UI aligned with the imported collections and avoids
      // misleading totals when only a subset of orders match reps.
      const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
        .where('salesOrderId', '==', order.salesOrderId)
        .get();

      let orderRevenue = 0;
      const seenSoItemIds = new Set<string>();

      // DEBUG: Log first 3 orders (regardless of rep matching) to diagnose revenue calculation
      if (totalOrders <= 3) {
        console.log(`\n🔍 DEBUG Order #${totalOrders}:`);
        console.log(`   SO Number: ${order.soNumber || order.num || orderDoc.id}`);
        console.log(`   Sales Order ID: ${order.salesOrderId}`);
        console.log(`   Customer ID: ${order.customerId}`);
        console.log(`   Sales Person: ${order.salesPerson}`);
        console.log(`   Line items found: ${lineItemsSnapshot.size}`);
      }

      lineItemsSnapshot.forEach(itemDoc => {
        const item = itemDoc.data();
        
        // De-duplicate line items (same logic as commission calculation)
        const soItemId = String(item.soItemId ?? item.soItemID ?? item.lineItemId ?? item.id ?? '');
        if (soItemId && seenSoItemIds.has(soItemId)) {
          if (totalOrders <= 3) {
            console.log(`   - SKIPPING DUPLICATE: ${soItemId}`);
          }
          return; // Skip duplicate
        }
        if (soItemId) {
          seenSoItemIds.add(soItemId);
        }

        let itemPrice = item.totalPrice || 0;
        const calculatedPrice = (item.unitPrice || 0) * (item.quantity || 0);

        // HARD FAIL: detect schema drift (totalPrice missing but should be > 0)
        if ((item.totalPrice || 0) === 0 && calculatedPrice > 0) {
          suspiciousLineItems++;
          if (suspiciousSamples.length < 10) {
            suspiciousSamples.push(
              `Order ${order.soNumber || order.num || orderDoc.id} | Item ${item.soItemId || itemDoc.id} | ${item.productNum || item.partNumber || ''} | qty=${item.quantity || 0} unit=$${item.unitPrice || 0} totalPrice=$${item.totalPrice || 0}`
            );
          }
        }

        if (itemPrice === 0 && calculatedPrice > 0) {
          itemPrice = calculatedPrice;
        }

        orderRevenue += itemPrice;

        if (totalOrders <= 3) {
          console.log(`   - Item ${item.soItemId}: totalPrice=$${item.totalPrice}, calculated=$${calculatedPrice}, using=$${itemPrice}`);
        }
      });
      
      // Log duplicate detection
      const duplicatesSkipped = lineItemsSnapshot.size - seenSoItemIds.size;
      if (duplicatesSkipped > 0 && totalOrders <= 3) {
        console.log(`   ⚠️ Skipped ${duplicatesSkipped} duplicate line items`);
      }

      if (totalOrders <= 3) {
        console.log(`   Order Revenue Total: $${orderRevenue}`);
      }

      // Total revenue should reflect the month's imported data, not just matched/commissionable orders.
      totalRevenue += orderRevenue;
      
      // Track admin orders (non-commissionable but included in total revenue)
      if (order.salesPerson === 'admin' || order.salesPerson === 'Admin') {
        adminOrders.push(order.soNumber || order.num || orderDoc.id);
        matchedOrders++; // Count as matched (just non-commissionable)
        
        // Add to admin rep breakdown for visibility
        if (!repBreakdown.has('admin')) {
          repBreakdown.set('admin', {
            repName: 'Admin/House',
            repId: 'admin',
            orderCount: 0,
            estimatedRevenue: 0,
            status: 'active',
            warnings: []
          });
        }
        const adminBreakdown = repBreakdown.get('admin')!;
        adminBreakdown.orderCount++;
        adminBreakdown.estimatedRevenue += orderRevenue;
        continue; // Don't validate customer/rep for admin orders
      }
      
      // Skip orders that were manually corrected in previous uploads
      // The DB data is correct, so no validation needed.
      // NOTE: Revenue was already included above.
      if (order.manuallyLinked === true) {
        matchedOrders++; // Count as matched since it was manually fixed
        continue;
      }
      
      // Determine effective sales person
      // CRITICAL: ONLY use order.salesPerson (Column T from Conversite CSV)
      let effectiveSalesPerson = order.salesPerson;
      
      // Check if rep exists and is active
      const rep = repsMap.get(effectiveSalesPerson) || repsByName.get(effectiveSalesPerson);
      
      const isUnmatchedOrInactive = !rep || !rep.isActive;
      if (isUnmatchedOrInactive) {
        unmatchedReps.add(effectiveSalesPerson);
      }
      
      // Revenue was calculated above for every non-admin order.
      
      // Check if customer exists and track account type issues
      const customer = customersMap.get(order.customerId) || 
                      customersMap.get(order.customerNum) ||
                      customersMap.get(order.accountNumber);
      
      if (!customer) {
        missingCustomers.push(order.soNumber || order.num || orderDoc.id);
        
        // Track as orphaned - customer not found (will default to Wholesale and be processed)
        customerNotFoundOrders.push({
          orderNum: order.soNumber || order.num || orderDoc.id,
          customerName: order.customerName || 'Unknown',
          customerId: order.customerId || 'N/A',
          revenue: orderRevenue,
          salesPerson: effectiveSalesPerson
        });
      }
      // REMOVED: Retail exclusion tracking - all orders now processed with clean CSV data
      
      // Revenue already included above.
      matchedOrders++;
      
      // Update rep breakdown - include ALL orders (even unmatched/inactive) so totals match
      const repKey = rep?.salesPerson || effectiveSalesPerson || 'Unknown';
      if (!repBreakdown.has(repKey)) {
        repBreakdown.set(repKey, {
          repName: rep?.name || effectiveSalesPerson || 'Unknown',
          repId: repKey,
          orderCount: 0,
          estimatedRevenue: 0,
          status: rep?.isActive ? 'active' : 'inactive',
          warnings: isUnmatchedOrInactive ? ['Rep not found or inactive in system'] : []
        });
      }
      
      const breakdown = repBreakdown.get(repKey)!;
      breakdown.orderCount++;
      breakdown.estimatedRevenue += orderRevenue;
    }
    
    // Generate warnings
    if (suspiciousLineItems > 0) {
      warnings.push({
        type: 'dataQuality',
        severity: 'error',
        count: suspiciousLineItems,
        message: 'Data quality failure: detected line items where Total Price is $0 but Unit Price × Qty fulfilled > $0. This indicates the Fishbowl import column mapping/header normalization is broken. Re-import with correct headers before proceeding.',
        details: suspiciousSamples
      });
    }

    if (adminOrders.length > 0) {
      warnings.push({
        type: 'unmatchedRep',
        severity: 'info',
        count: adminOrders.length,
        message: `${adminOrders.length} admin/house orders (expected - these are house accounts)`,
        details: adminOrders.slice(0, 10)
      });
    }
    
    if (unmatchedReps.size > 0) {
      warnings.push({
        type: 'unmatchedRep',
        severity: 'warning',
        count: unmatchedReps.size,
        message: `${unmatchedReps.size} orders with unmatched or inactive reps`,
        details: Array.from(unmatchedReps)
      });
    }
    
    if (customerNotFoundOrders.length > 0) {
      const totalOrphanedRevenue = customerNotFoundOrders.reduce((sum, o) => sum + o.revenue, 0);
      const affectedReps = [...new Set(customerNotFoundOrders.map(o => o.salesPerson))];
      
      warnings.push({
        type: 'customerNotFound',
        severity: 'error',
        count: customerNotFoundOrders.length,
        totalRevenue: totalOrphanedRevenue,
        affectedReps: affectedReps,
        message: `🚨 ${customerNotFoundOrders.length} orders with MISSING CUSTOMER records (defaulting to Retail = EXCLUDED from commissions)`,
        details: customerNotFoundOrders.slice(0, 20).map(o => 
          `Order ${o.orderNum} | ${o.customerName} (ID: ${o.customerId}) | $${o.revenue.toFixed(2)} | Rep: ${o.salesPerson}`
        ),
        orderNumbers: customerNotFoundOrders.map(o => o.orderNum)
      });
    }
    
    if (retailExcludedOrders.length > 0) {
      const totalRetailRevenue = retailExcludedOrders.reduce((sum, o) => sum + o.revenue, 0);
      const affectedReps = [...new Set(retailExcludedOrders.map(o => o.salesPerson))];
      
      warnings.push({
        type: 'retailExcluded',
        severity: 'warning',
        count: retailExcludedOrders.length,
        totalRevenue: totalRetailRevenue,
        affectedReps: affectedReps,
        message: `⚠️ ${retailExcludedOrders.length} orders from RETAIL customers (EXCLUDED from commissions)`,
        details: retailExcludedOrders.slice(0, 20).map(o => 
          `Order ${o.orderNum} | ${o.customerName} | $${o.revenue.toFixed(2)} | Rep: ${o.salesPerson}`
        ),
        orderNumbers: retailExcludedOrders.map(o => o.orderNum)
      });
    }
    
    // Add orphaned orders summary by sales person
    if (orphanedOrdersBySalesPerson.size > 0) {
      const totalOrphanedRevenue = Array.from(orphanedOrdersBySalesPerson.values())
        .reduce((sum, stats) => sum + stats.revenue, 0);
      const totalOrphanedOrders = Array.from(orphanedOrdersBySalesPerson.values())
        .reduce((sum, stats) => sum + stats.orders, 0);
      
      const orphanDetails = Array.from(orphanedOrdersBySalesPerson.entries())
        .map(([rep, stats]) => `${rep}: ${stats.orders} orders | $${stats.revenue.toFixed(2)}`)
        .sort((a, b) => {
          const aRev = parseFloat(a.split('$')[1]);
          const bRev = parseFloat(b.split('$')[1]);
          return bRev - aRev;
        });
      
      warnings.push({
        type: 'orphanedOrders',
        severity: 'error',
        count: totalOrphanedOrders,
        totalRevenue: totalOrphanedRevenue,
        message: `🚨 ORPHANED COMMISSIONS: ${totalOrphanedOrders} orders ($${totalOrphanedRevenue.toFixed(2)}) NOT being calculated`,
        details: orphanDetails,
        affectedReps: Array.from(orphanedOrdersBySalesPerson.keys())
      });
    }
    
    // Build field mapping
    const fieldMapping: FieldMapping = {
      detected: {
        salesPerson: Array.from(fieldVariations.salesPerson),
        orderNumber: Array.from(fieldVariations.orderNumber),
        customerId: Array.from(fieldVariations.customerId)
      },
      suggested: {
        salesPerson: 'salesPerson',
        orderNumber: 'soNumber',
        customerId: 'customerId'
      },
      conflicts: []
    };
    
    // Check for conflicts
    if (fieldVariations.salesPerson.size > 1) {
      fieldMapping.conflicts.push(`Multiple sales person fields detected: ${Array.from(fieldVariations.salesPerson).join(', ')}`);
    }
    
    console.log(`✅ Validation complete: ${matchedOrders}/${totalOrders} orders matched`);
    console.log(`🚨 ORPHANED: ${customerNotFoundOrders.length + retailExcludedOrders.length} orders excluded from commissions`);
    console.log(`   - Customer Not Found: ${customerNotFoundOrders.length} orders`);
    console.log(`   - Retail Excluded: ${retailExcludedOrders.length} orders`);
    
    if (orphanedOrdersBySalesPerson.size > 0) {
      console.log(`\n📊 ORPHANED ORDERS BY REP:`);
      Array.from(orphanedOrdersBySalesPerson.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .forEach(([rep, stats]) => {
          console.log(`   ${rep}: ${stats.orders} orders | $${stats.revenue.toFixed(2)}`);
        });
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json({
      valid: warnings.filter(w => w.severity === 'error').length === 0,
      commissionMonth,
      totalEstimatedRevenue: totalRevenue, // Fixed: return number, not string
      excludedOrders: retailExcludedOrders, // For backward compatibility
      orphanedOrders: {
        retail: retailExcludedOrders,
        customerNotFound: customerNotFoundOrders,
        all: [...customerNotFoundOrders, ...retailExcludedOrders]
      },
      statistics: {
        totalOrders,
        matchedOrders,
        unmatchedOrders: totalOrders - matchedOrders,
        activeReps: repBreakdown.size,
        totalRevenue
      },
      fieldMapping,
      warnings,
      repBreakdown: Array.from(repBreakdown.values()).sort((a, b) => b.estimatedRevenue - a.estimatedRevenue)
    });
    
  } catch (error: any) {
    console.error('❌ Validation error:', error);
    return NextResponse.json({
      error: error.message || 'Validation failed',
      details: error.stack
    }, { status: 500 });
  }
}
