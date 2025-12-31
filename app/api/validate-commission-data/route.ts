import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ValidationWarning {
  type: 'unmatchedRep' | 'missingCustomer' | 'inactiveRep' | 'missingRate' | 'dataQuality';
  severity: 'error' | 'warning' | 'info';
  count: number;
  message: string;
  details?: string[];
  orderNumbers?: string[];
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
      if (order.salesRep !== undefined) fieldVariations.salesPerson.add('salesRep');
      if (order.soNumber !== undefined) fieldVariations.orderNumber.add('soNumber');
      if (order.num !== undefined) fieldVariations.orderNumber.add('num');
      if (order.customerId !== undefined) fieldVariations.customerId.add('customerId');
      if (order.customerNum !== undefined) fieldVariations.customerId.add('customerNum');
      
      // Check for admin orders
      if (order.salesPerson === 'admin' || order.salesPerson === 'Admin') {
        adminOrders.push(order.soNumber || order.num || orderDoc.id);
        
        // Check if customer has assigned rep
        const customer = customersMap.get(order.customerId);
        if (!customer?.salesPerson) {
          continue; // Skip - no rep assignment
        }
      }
      
      // Determine effective sales person
      // CRITICAL: ONLY use order.salesPerson (Column T from Conversite CSV)
      let effectiveSalesPerson = order.salesPerson;
      if (order.salesPerson === 'admin' || order.salesPerson === 'Admin') {
        const customer = customersMap.get(order.customerId);
        effectiveSalesPerson = customer?.salesPerson || 'admin';
      }
      
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
      
      // Check if customer exists
      const customer = customersMap.get(order.customerId);
      if (!customer) {
        missingCustomers.push(order.soNumber || order.num || orderDoc.id);
      }
      
      // Calculate revenue from line items (Conversite data is line-item based)
      const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
        .where('salesOrderId', '==', order.salesOrderId)
        .get();
      
      let orderRevenue = 0;
      lineItemsSnapshot.forEach(itemDoc => {
        const item = itemDoc.data();
        orderRevenue += item.totalPrice || 0;
      });
      
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
    
    if (missingCustomers.length > 0) {
      warnings.push({
        type: 'missingCustomer',
        severity: 'warning',
        count: missingCustomers.length,
        message: `${missingCustomers.length} orders with missing customer data (will default to Retail)`,
        orderNumbers: missingCustomers.slice(0, 10)
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return NextResponse.json({
      valid: warnings.filter(w => w.severity === 'error').length === 0,
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
