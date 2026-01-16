import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * NEW COMMISSION CALCULATION ENGINE V2
 * Clean implementation focused on accuracy and transparency
 */
export async function POST(req: NextRequest) {
  try {
    const { commissionMonth } = await req.json();
    
    if (!commissionMonth) {
      return NextResponse.json({ error: 'commissionMonth is required' }, { status: 400 });
    }
    
    console.log(`\n🚀 COMMISSION CALCULATION V2 - ${commissionMonth}`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    const startTime = Date.now();
    
    // STEP 1: Load all line items for the commission month
    console.log('\n📦 STEP 1: Loading line items...');
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
      .where('commissionMonth', '==', commissionMonth)
      .get();
    
    console.log(`   Found ${lineItemsSnapshot.size} line items`);
    
    // STEP 2: Load commission rules
    console.log('\n⚙️  STEP 2: Loading commission rules...');
    const rulesDoc = await adminDb.collection('commission_rules').doc('default').get();
    const rules = rulesDoc.exists ? rulesDoc.data() : {
      excludeShipping: true,
      excludeCCProcessing: true,
      useOrderValue: false
    };
    console.log(`   Rules:`, rules);
    
    // STEP 3: Load all customers
    console.log('\n👥 STEP 3: Loading customers...');
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    const customersMap = new Map();
    
    customersSnapshot.forEach(doc => {
      const customer = doc.data();
      
      // Normalize accountType
      let accountType = customer.accountType || 'Retail';
      if (Array.isArray(accountType) && accountType.length > 0) {
        const typeId = accountType[0];
        if (typeId === 2063862 || typeId === '2063862') accountType = 'Wholesale';
        else if (typeId === 1981470 || typeId === '1981470') accountType = 'Distributor';
        else if (typeId === 2066840 || typeId === '2066840') accountType = 'Retail';
        else accountType = 'Retail';
      } else if (typeof accountType !== 'string') {
        accountType = 'Retail';
      }
      
      const normalizedCustomer = {
        ...customer,
        accountType
      };
      
      customersMap.set(doc.id, normalizedCustomer);
      if (customer.customerId) customersMap.set(customer.customerId, normalizedCustomer);
      if (customer.customerNum) customersMap.set(customer.customerNum, normalizedCustomer);
      if (customer.accountNumber) customersMap.set(customer.accountNumber?.toString(), normalizedCustomer);
      if (customer.name) customersMap.set(customer.name, normalizedCustomer);
    });
    
    console.log(`   Loaded ${customersSnapshot.size} customers`);
    
    // STEP 4: Load all commissioned reps
    console.log('\n👤 STEP 4: Loading sales reps...');
    const repsSnapshot = await adminDb.collection('users')
      .where('isCommissioned', '==', true)
      .get();
    
    const repsMap = new Map();
    repsSnapshot.forEach(doc => {
      const rep = doc.data();
      if (rep.salesPerson) {
        repsMap.set(rep.salesPerson, {
          id: doc.id,
          name: rep.name,
          salesPerson: rep.salesPerson,
          title: rep.title || 'Account Executive', // Include job title
          active: rep.isActive !== false
        });
      }
    });
    
    console.log(`   Loaded ${repsMap.size} commissioned reps`);
    
    // STEP 5: Load commission rates by title from settings
    console.log('\n💰 STEP 5: Loading commission rates by title...');
    const settingsSnapshot = await adminDb.collection('settings').get();
    const commissionRatesByTitle = new Map();
    
    settingsSnapshot.forEach(doc => {
      if (doc.id.startsWith('commission_rates_')) {
        // Extract title from document ID (e.g., "commission_rates_Account_Executive" -> "Account Executive")
        const titleKey = doc.id.replace('commission_rates_', '').replace(/_/g, ' ');
        commissionRatesByTitle.set(titleKey, doc.data());
      }
    });
    
    console.log(`   Loaded commission rates for ${commissionRatesByTitle.size} titles`);
    
    // STEP 6: Group line items by sales order NUMBER (not salesOrderId)
    console.log('\n📊 STEP 6: Grouping line items by sales order...');
    const orderMap = new Map();
    
    let debugCount = 0;
    lineItemsSnapshot.forEach(doc => {
      const item = doc.data();
      const soNumber = item.soNumber || item['Sales order Number'];
      
      // Debug first 5 items to see what's in Firestore
      if (debugCount < 5) {
        console.log(`\n🔍 DEBUG Line Item ${debugCount + 1}:`);
        console.log(`   Doc ID: ${doc.id}`);
        console.log(`   soNumber: ${soNumber}`);
        console.log(`   Product: ${item.Product}`);
        console.log(`   product: ${item.product}`);
        console.log(`   quantity: ${item.quantity}`);
        console.log(`   totalPrice: ${item.totalPrice}`);
        console.log(`   totalCost: ${item.totalCost}`);
        console.log(`   'Total price': ${item['Total price']}`);
        console.log(`   'Total cost': ${item['Total cost']}`);
        debugCount++;
      }
      
      if (!soNumber) {
        console.log('⚠️  Skipping line item without soNumber:', item.id);
        return;
      }
      
      if (!orderMap.has(soNumber)) {
        orderMap.set(soNumber, {
          salesOrderId: item.salesOrderId,
          soNumber: soNumber,
          salesPerson: item.salesPerson,
          customerId: item.customerId,
          customerName: item.customerName,
          lineItems: []
        });
      }
      
      orderMap.get(soNumber)!.lineItems.push({
        product: item.Product || item.product || item.productName || '',
        productNum: item['SO Item Product Number'] || item.productNum || '',
        quantity: item.quantity || 0,
        totalPrice: item.totalPrice || 0
      });
    });
    
    console.log(`\n   Grouped into ${orderMap.size} unique sales orders`);
    
    // STEP 7: Calculate commissions
    console.log('\n💵 STEP 7: Calculating commissions...');
    
    const results = [];
    const summary = {
      totalOrders: 0,
      calculatedOrders: 0,
      skippedRetail: 0,
      skippedNoCustomer: 0,
      skippedInactiveRep: 0,
      skippedAdmin: 0,
      skippedShopify: 0,
      totalRevenue: 0,
      totalCommission: 0,
      byRep: new Map()
    };
    
    for (const [salesOrderId, order] of orderMap.entries()) {
      summary.totalOrders++;
      
      // Skip admin orders
      const sp = (order.salesPerson || '').toUpperCase();
      if (sp === 'ADMIN' || sp === 'HOUSE') {
        summary.skippedAdmin++;
        continue;
      }
      
      // Skip Shopify/Commerce orders
      if (sp === 'SHOPIFY' || sp === 'COMMERCE' || order.soNumber?.startsWith('Sh')) {
        summary.skippedShopify++;
        continue;
      }
      
      // Get rep
      const rep = repsMap.get(order.salesPerson);
      if (!rep || !rep.active) {
        summary.skippedInactiveRep++;
        continue;
      }
      
      // Get customer
      const customer = customersMap.get(order.customerId) ||
                      customersMap.get(order.customerName);
      
      if (!customer) {
        summary.skippedNoCustomer++;
        continue;
      }
      
      // Skip retail
      if (customer.accountType === 'Retail') {
        summary.skippedRetail++;
        continue;
      }
      
      // Calculate order amount from line items
      let orderAmount = 0;
      const includedItems = [];
      const excludedItems = [];
      
      for (const item of order.lineItems) {
        const productName = (item.product || '').toLowerCase();
        const productNum = (item.productNum || '').toLowerCase();
        
        const isShipping = (rules?.excludeShipping ?? true) && (
          productName.includes('shipping') || 
          productNum.includes('shipping')
        );
        
        const isCCProcessing = (rules?.excludeCCProcessing ?? true) && (
          productName.includes('cc processing') ||
          productName.includes('credit card processing') ||
          productNum.includes('cc processing')
        );
        
        if (isShipping || isCCProcessing) {
          excludedItems.push({
            product: item.product,
            reason: isShipping ? 'Shipping' : 'CC Processing',
            amount: item.totalPrice
          });
        } else {
          orderAmount += item.totalPrice;
          includedItems.push({
            product: item.product,
            quantity: item.quantity,
            amount: item.totalPrice
          });
        }
      }
      
      // Get commission rate based on rep's title
      const segment = customer.accountType; // Wholesale or Distributor
      const status = 'own'; // Simplified for now - can add transfer logic later
      
      // Get commission rates for this rep's title
      const repCommissionRates = commissionRatesByTitle.get(rep.title);
      let rate = 0;
      
      if (repCommissionRates?.rates && Array.isArray(repCommissionRates.rates)) {
        // Map segment to segmentId
        const segmentId = segment === 'Wholesale' ? 'wholesale' : 'distributor';
        const mappedStatus = status === 'own' ? 'new_business' : 'transfer';
        
        // Find matching rate
        const rateObj = repCommissionRates.rates.find((r: any) => 
          r.title === rep.title && 
          r.segmentId === segmentId && 
          r.status === mappedStatus &&
          r.active !== false
        );
        
        if (rateObj && typeof rateObj.percentage === 'number') {
          rate = rateObj.percentage;
        }
      }
      
      // Fallback to default rates if no configured rate found
      if (!rate) {
        if (segment === 'Wholesale') rate = status === 'own' ? 3 : 2;
        else if (segment === 'Distributor') rate = status === 'own' ? 5 : 2;
        else rate = 0;
      }
      
      // Calculate commission
      const commissionAmount = orderAmount * rate / 100;
      
      summary.calculatedOrders++;
      summary.totalRevenue += orderAmount;
      summary.totalCommission += commissionAmount;
      
      // Update rep summary
      if (!summary.byRep.has(order.salesPerson)) {
        summary.byRep.set(order.salesPerson, {
          repName: rep.name,
          orders: 0,
          revenue: 0,
          commission: 0
        });
      }
      
      const repSummary = summary.byRep.get(order.salesPerson)!;
      repSummary.orders++;
      repSummary.revenue += orderAmount;
      repSummary.commission += commissionAmount;
      
      // Store detailed result
      results.push({
        orderNum: order.soNumber,
        salesOrderId,
        salesPerson: order.salesPerson,
        repName: rep.name,
        customerName: order.customerName,
        accountType: segment,
        status,
        lineItemCount: order.lineItems.length,
        includedItemCount: includedItems.length,
        excludedItemCount: excludedItems.length,
        orderAmount,
        commissionRate: rate,
        commissionAmount,
        includedItems,
        excludedItems
      });
    }
    
    const duration = Date.now() - startTime;
    
    console.log('\n✅ CALCULATION COMPLETE');
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Total Orders: ${summary.totalOrders}`);
    console.log(`   Calculated: ${summary.calculatedOrders}`);
    console.log(`   Skipped Retail: ${summary.skippedRetail}`);
    console.log(`   Skipped No Customer: ${summary.skippedNoCustomer}`);
    console.log(`   Skipped Inactive Rep: ${summary.skippedInactiveRep}`);
    console.log(`   Total Revenue: $${summary.totalRevenue.toFixed(2)}`);
    console.log(`   Total Commission: $${summary.totalCommission.toFixed(2)}`);
    console.log('\n   By Rep:');
    
    const repSummary = Array.from(summary.byRep.entries()).map(([salesPerson, stats]) => ({
      salesPerson,
      ...stats
    })).sort((a, b) => b.revenue - a.revenue);
    
    repSummary.forEach(rep => {
      console.log(`      ${rep.repName}: ${rep.orders} orders | $${rep.revenue.toFixed(2)} revenue | $${rep.commission.toFixed(2)} commission`);
    });
    
    return NextResponse.json({
      success: true,
      commissionMonth,
      duration,
      summary: {
        totalOrders: summary.totalOrders,
        calculatedOrders: summary.calculatedOrders,
        skippedRetail: summary.skippedRetail,
        skippedNoCustomer: summary.skippedNoCustomer,
        skippedInactiveRep: summary.skippedInactiveRep,
        skippedAdmin: summary.skippedAdmin,
        skippedShopify: summary.skippedShopify,
        totalRevenue: summary.totalRevenue,
        totalCommission: summary.totalCommission,
        byRep: repSummary
      },
      results: results.sort((a, b) => b.orderAmount - a.orderAmount)
    });
    
  } catch (error: any) {
    console.error('❌ Error calculating commissions V2:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to calculate commissions' 
    }, { status: 500 });
  }
}
