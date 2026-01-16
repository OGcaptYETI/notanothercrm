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
      
      // Skip admin orders entirely - they are for information only
      if (order.salesPerson === 'admin' || order.salesPerson === 'Admin') {
        adminOrders.push(order.soNumber || order.num || orderDoc.id);
        continue; // Skip admin orders completely
      }
      
      // Determine effective sales person
      // CRITICAL: ONLY use order.salesPerson (Column T from Conversite CSV)
      let effectiveSalesPerson = order.salesPerson;
      
      // Check if rep exists and is active
      const rep = repsMap.get(effectiveSalesPerson) || repsByName.get(effectiveSalesPerson);
      
      if (!rep) {
        unmatchedReps.add(effectiveSalesPerson);
        continue;
      }
      
      if (!rep.isActive) {
        unmatchedReps.add(effectiveSalesPerson);
        continue;
      }
      
      // Calculate revenue from line items FIRST (Conversite data is line-item based)
      const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
        .where('salesOrderId', '==', order.salesOrderId)
        .get();
      
      let orderRevenue = 0;
      lineItemsSnapshot.forEach(itemDoc => {
        const item = itemDoc.data();
        orderRevenue += item.totalPrice || 0;
      });
      
      // Check if customer exists and track account type issues
      const customer = customersMap.get(order.customerId) || 
                      customersMap.get(order.customerNum) ||
                      customersMap.get(order.accountNumber);
      
      if (!customer) {
        missingCustomers.push(order.soNumber || order.num || orderDoc.id);
        
        // Track as orphaned - customer not found, will default to Retail and be skipped
        customerNotFoundOrders.push({
          orderNum: order.soNumber || order.num || orderDoc.id,
          customerName: order.customerName || 'Unknown',
          customerId: order.customerId || 'N/A',
          revenue: orderRevenue,
          salesPerson: effectiveSalesPerson
        });
        
        // Track by sales person
        if (!orphanedOrdersBySalesPerson.has(effectiveSalesPerson)) {
          orphanedOrdersBySalesPerson.set(effectiveSalesPerson, {orders: 0, revenue: 0});
        }
        const orphanStats = orphanedOrdersBySalesPerson.get(effectiveSalesPerson)!;
        orphanStats.orders++;
        orphanStats.revenue += orderRevenue;
      } else if (customer.accountType === 'Retail') {
        // Track retail exclusions (but skip house accounts and $0 orders to reduce noise)
        const customerNameLower = (order.customerName || customer.name || '').toLowerCase();
        const isHouseAccount = customerNameLower.includes('house') || 
                               customerNameLower.includes('sample') ||
                               customerNameLower.includes('admin');
        const hasRevenue = orderRevenue > 0;
        
        // Only track meaningful retail exclusions
        if (!isHouseAccount && hasRevenue) {
          retailExcludedOrders.push({
            orderNum: order.soNumber || order.num || orderDoc.id,
            customerName: order.customerName || customer.name || 'Unknown',
            customerId: order.customerId,
            accountType: customer.accountType,
            revenue: orderRevenue,
            salesPerson: effectiveSalesPerson
          });
          
          // Track by sales person
          if (!orphanedOrdersBySalesPerson.has(effectiveSalesPerson)) {
            orphanedOrdersBySalesPerson.set(effectiveSalesPerson, {orders: 0, revenue: 0});
          }
          const orphanStats = orphanedOrdersBySalesPerson.get(effectiveSalesPerson)!;
          orphanStats.orders++;
          orphanStats.revenue += orderRevenue;
        }
      }
      
      totalRevenue += orderRevenue;
      matchedOrders++;
      
      // Update rep breakdown
      const repKey = rep.salesPerson;
      if (!repBreakdown.has(repKey)) {
        repBreakdown.set(repKey, {
          repName: rep.name,
          repId: repKey,
          orderCount: 0,
          estimatedRevenue: 0,
          status: rep.isActive ? 'active' : 'inactive',
          warnings: []
        });
      }
      
      const breakdown = repBreakdown.get(repKey)!;
      breakdown.orderCount++;
      breakdown.estimatedRevenue += orderRevenue;
    }
    
    // Generate warnings
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
      excludedOrders: {
        retail: retailExcludedOrders,
        customerNotFound: customerNotFoundOrders
      },
      statistics: {
        totalOrders,
        matchedOrders,
        unmatchedOrders: totalOrders - matchedOrders,
        activeReps: repBreakdown.size,
        totalRevenue: totalRevenue.toFixed(2)
      },
      fieldMapping,
      warnings,
      repBreakdown: Array.from(repBreakdown.values()).sort((a, b) => b.orderCount - a.orderCount)
    });
    
  } catch (error: any) {
    console.error('❌ Validation error:', error);
    return NextResponse.json({
      error: error.message || 'Validation failed',
      details: error.stack
    }, { status: 500 });
  }
}
