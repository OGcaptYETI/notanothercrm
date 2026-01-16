import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Update fishbowl_sales_orders with correct account types from fishbowl_customers
 * This fixes orders that were imported with "Retail" from CSV but should be Wholesale/Distributor
 */
export async function POST(req: NextRequest) {
  try {
    const { commissionMonth, dryRun = true } = await req.json();
    
    if (!commissionMonth) {
      return NextResponse.json({ error: 'commissionMonth is required (e.g., "2025-12")' }, { status: 400 });
    }
    
    console.log(`\n🔄 UPDATING ORDER ACCOUNT TYPES FOR: ${commissionMonth}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Load all customers with their account types
    console.log('📋 Loading fishbowl_customers...');
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    const customersMap = new Map<string, any>();
    
    customersSnapshot.forEach(doc => {
      const data = doc.data();
      const customerId = data.customerId || data.id || doc.id;
      customersMap.set(customerId, data);
      
      // Also map by other IDs
      if (data.customerNum) customersMap.set(data.customerNum, data);
      if (data.accountNumber) customersMap.set(data.accountNumber, data);
    });
    
    console.log(`✅ Loaded ${customersMap.size} customers`);
    
    // Load orders for the specified month
    console.log(`📦 Loading orders for ${commissionMonth}...`);
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders')
      .where('commissionMonth', '==', commissionMonth)
      .get();
    
    console.log(`✅ Loaded ${ordersSnapshot.size} orders`);
    
    // Analyze and update
    let updated = 0;
    let unchanged = 0;
    let notFound = 0;
    let errors = 0;
    
    const changes: Array<{
      orderNum: string;
      customerName: string;
      customerId: string;
      oldType: string;
      newType: string;
    }> = [];
    
    let batch = adminDb.batch();
    let batchCount = 0;
    const MAX_BATCH = 400;
    
    for (const orderDoc of ordersSnapshot.docs) {
      const order = orderDoc.data();
      const customerId = order.customerId;
      
      if (!customerId) {
        notFound++;
        continue;
      }
      
      // Look up customer
      const customer = customersMap.get(customerId);
      
      if (!customer) {
        notFound++;
        console.log(`⚠️  Customer not found: ${customerId} (${order.customerName})`);
        continue;
      }
      
      let currentAccountType = order.accountType || 'Retail';
      let correctAccountType = customer.accountType || 'Retail';
      
      // Normalize Copper field IDs to readable values
      const normalizeAccountType = (type: any): string => {
        if (!type) return 'Retail';
        
        // Handle array format
        if (Array.isArray(type) && type.length > 0) {
          type = type[0];
        }
        
        // Convert Copper field IDs to readable values
        if (type === 2063862 || type === '2063862') return 'Wholesale';
        if (type === 1981470 || type === '1981470') return 'Distributor';
        
        // Already a string
        if (typeof type === 'string') return type;
        
        return String(type);
      };
      
      currentAccountType = normalizeAccountType(currentAccountType);
      correctAccountType = normalizeAccountType(correctAccountType);
      
      // Check if update needed
      if (currentAccountType !== correctAccountType) {
        changes.push({
          orderNum: order.num || order.soNumber || orderDoc.id,
          customerName: order.customerName || customer.name || 'Unknown',
          customerId: customerId,
          oldType: currentAccountType,
          newType: correctAccountType
        });
        
        if (!dryRun) {
          const orderRef = adminDb.collection('fishbowl_sales_orders').doc(orderDoc.id);
          batch.update(orderRef, {
            accountType: correctAccountType,
            accountTypeSource: customer.accountTypeSource || 'customer_sync',
            updatedAt: Timestamp.now()
          });
          batchCount++;
          
          if (batchCount >= MAX_BATCH) {
            await batch.commit();
            console.log(`✅ Committed batch of ${batchCount} updates`);
            batch = adminDb.batch();
            batchCount = 0;
          }
        }
        
        updated++;
      } else {
        unchanged++;
      }
    }
    
    // Commit final batch
    if (!dryRun && batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} updates`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 UPDATE SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Orders:        ${ordersSnapshot.size}`);
    console.log(`Would Update:        ${updated}`);
    console.log(`Unchanged:           ${unchanged}`);
    console.log(`Customer Not Found:  ${notFound}`);
    console.log(`Errors:              ${errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Show sample changes
    if (changes.length > 0) {
      console.log('📝 Sample Changes (first 20):');
      changes.slice(0, 20).forEach((change, i) => {
        console.log(`${i + 1}. Order ${change.orderNum} | ${change.customerName}`);
        console.log(`   ${change.oldType} → ${change.newType}`);
      });
      console.log('');
    }
    
    // Count by account type change
    const typeChanges = new Map<string, number>();
    changes.forEach(change => {
      const key = `${change.oldType} → ${change.newType}`;
      typeChanges.set(key, (typeChanges.get(key) || 0) + 1);
    });
    
    if (typeChanges.size > 0) {
      console.log('📊 Changes by Type:');
      Array.from(typeChanges.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`   ${type}: ${count} orders`);
        });
      console.log('');
    }
    
    return NextResponse.json({
      success: true,
      dryRun,
      commissionMonth,
      stats: {
        totalOrders: ordersSnapshot.size,
        updated,
        unchanged,
        notFound,
        errors
      },
      changes: changes.slice(0, 50), // Return first 50 changes
      typeChanges: Array.from(typeChanges.entries()).map(([type, count]) => ({ type, count }))
    });
    
  } catch (error: any) {
    console.error('❌ Error updating order account types:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to update order account types' 
    }, { status: 500 });
  }
}
