import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const customerId = '1684';
    const customerName = 'Adyah Wholesale';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 DEBUG ANALYSIS: Customer ${customerId} (${customerName})`);
    console.log(`${'='.repeat(80)}\n`);
    
    // 1. Get customer record
    const customerDoc = await adminDb.collection('fishbowl_customers').doc(customerId).get();
    const customerData = customerDoc.exists ? customerDoc.data() : null;
    
    const debugOutput: any = {
      customerId,
      customerName,
      customerRecord: {
        exists: customerDoc.exists,
        salesPerson: customerData?.salesPerson,
        fishbowlUsername: customerData?.fishbowlUsername,
        currentOwner: customerData?.currentOwner,
        transferStatus: customerData?.transferStatus,
        originalOwner: customerData?.originalOwner,
        accountType: customerData?.accountType
      },
      orders: [],
      analysis: {}
    };
    
    console.log('📋 Customer Record:');
    console.log(`   salesPerson: ${customerData?.salesPerson}`);
    console.log(`   fishbowlUsername: ${customerData?.fishbowlUsername}`);
    console.log(`   currentOwner: ${customerData?.currentOwner}`);
    console.log(`   transferStatus: ${customerData?.transferStatus || 'null (Auto mode)'}`);
    console.log(`   originalOwner: ${customerData?.originalOwner}`);
    console.log(`   accountType: ${customerData?.accountType}\n`);
    
    // 2. Get ALL orders for this customer
    const ordersQuery = await adminDb.collection('fishbowl_sales_orders')
      .where('customerId', '==', customerId)
      .orderBy('postingDate', 'asc')
      .get();
    
    console.log(`📦 Found ${ordersQuery.size} total orders:\n`);
    
    const orders: any[] = [];
    ordersQuery.forEach((doc) => {
      const order = doc.data();
      const orderDate = order.postingDate?.toDate();
      const orderInfo = {
        orderNum: order.orderNum,
        postingDate: orderDate ? orderDate.toISOString().split('T')[0] : 'N/A',
        salesPerson: order.salesPerson,
        customerName: order.customerName,
        totalAmount: order.totalAmount
      };
      orders.push(orderInfo);
      
      console.log(`   Order ${orderInfo.orderNum}:`);
      console.log(`      Date: ${orderInfo.postingDate}`);
      console.log(`      Rep: "${orderInfo.salesPerson}"`);
      console.log(`      Amount: $${orderInfo.totalAmount?.toFixed(2) || '0.00'}\n`);
    });
    
    debugOutput.orders = orders;
    
    // 3. Analyze rep consistency
    const uniqueReps = new Set(orders.map(o => o.salesPerson));
    const repCounts = new Map<string, number>();
    orders.forEach(o => {
      const count = repCounts.get(o.salesPerson) || 0;
      repCounts.set(o.salesPerson, count + 1);
    });
    
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 ANALYSIS:');
    console.log(`${'='.repeat(80)}\n`);
    console.log(`Unique sales rep values found: ${uniqueReps.size}`);
    uniqueReps.forEach(rep => {
      console.log(`   "${rep}" - ${repCounts.get(rep)} orders`);
    });
    
    debugOutput.analysis = {
      uniqueReps: Array.from(uniqueReps),
      repCounts: Object.fromEntries(repCounts),
      hasMultipleReps: uniqueReps.size > 1,
      firstOrderRep: orders[0]?.salesPerson,
      lastOrderRep: orders[orders.length - 1]?.salesPerson
    };
    
    // 4. Check December 2025 commission record
    console.log(`\n${'='.repeat(80)}`);
    console.log('💰 December 2025 Commission Records:');
    console.log(`${'='.repeat(80)}\n`);
    
    const commissionQuery = await adminDb.collection('monthly_commissions')
      .where('customerId', '==', customerId)
      .where('commissionMonth', '==', '2025-12')
      .get();
    
    const commissionRecords: any[] = [];
    commissionQuery.forEach((doc) => {
      const comm = doc.data();
      const record = {
        orderNum: comm.orderNum,
        repName: comm.repName,
        salesPerson: comm.salesPerson,
        customerStatus: comm.customerStatus,
        commissionRate: comm.commissionRate,
        orderRevenue: comm.orderRevenue,
        commissionAmount: comm.commissionAmount
      };
      commissionRecords.push(record);
      
      console.log(`   Order ${record.orderNum}:`);
      console.log(`      Rep: ${record.repName} (${record.salesPerson})`);
      console.log(`      Status: ${record.customerStatus}`);
      console.log(`      Rate: ${record.commissionRate}%`);
      console.log(`      Revenue: $${record.orderRevenue?.toFixed(2) || '0.00'}`);
      console.log(`      Commission: $${record.commissionAmount?.toFixed(2) || '0.00'}\n`);
    });
    
    debugOutput.commissionRecords = commissionRecords;
    
    // 5. Conclusion
    console.log(`\n${'='.repeat(80)}`);
    console.log('🎯 CONCLUSION:');
    console.log(`${'='.repeat(80)}\n`);
    
    if (uniqueReps.size > 1) {
      console.log('❌ PROBLEM IDENTIFIED:');
      console.log(`   Multiple sales rep values detected for same customer!`);
      console.log(`   This causes false "transferred" detection.\n`);
      console.log('   Rep values found:');
      uniqueReps.forEach(rep => {
        console.log(`      - "${rep}"`);
      });
      console.log(`\n   These likely represent the SAME PERSON with different name formats.`);
      console.log(`   The system is comparing these strings and detecting a "rep change".`);
      
      debugOutput.conclusion = {
        issue: 'Multiple rep name formats detected',
        reps: Array.from(uniqueReps),
        recommendation: 'Normalize rep names before comparison or use fishbowlUsername field'
      };
    } else {
      console.log('✅ All orders have consistent sales rep value.');
      console.log(`   Rep: "${Array.from(uniqueReps)[0]}"`);
      console.log(`\n   If still showing as transferred, check:`);
      console.log(`   1. Current order rep value in calculation`);
      console.log(`   2. Manual transferStatus override in customer record`);
      
      debugOutput.conclusion = {
        issue: 'Consistent rep values - need to check calculation logic',
        rep: Array.from(uniqueReps)[0],
        recommendation: 'Review current order rep value and manual overrides'
      };
    }
    
    console.log(`\n${'='.repeat(80)}\n`);
    
    return NextResponse.json({
      success: true,
      debug: debugOutput
    });
    
  } catch (error: any) {
    console.error('Error debugging customer 1684:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
