import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FixOrderCustomerRequest {
  orderNumber: string;
  oldCustomerId: string;
  newCustomerId: string;
  newAccountType?: string;
  rememberCorrection: boolean;
  reason?: string;
  correctedBy?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { 
      orderNumber, 
      oldCustomerId, 
      newCustomerId,
      newAccountType,
      rememberCorrection,
      reason = 'Manual correction via validation UI',
      correctedBy = 'admin'
    }: FixOrderCustomerRequest = await req.json();
    
    if (!orderNumber || !newCustomerId) {
      return NextResponse.json({ 
        error: 'orderNumber and newCustomerId are required' 
      }, { status: 400 });
    }
    
    const batch = adminDb.batch();
    
    // 1. Update the order in fishbowl_sales_orders
    const orderRef = adminDb.collection('fishbowl_sales_orders').doc(orderNumber);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      return NextResponse.json({ 
        error: `Order ${orderNumber} not found` 
      }, { status: 404 });
    }
    
    const orderData = orderDoc.data();
    
    // Get new customer data for account type
    const newCustomerRef = adminDb.collection('fishbowl_customers').doc(newCustomerId);
    const newCustomerDoc = await newCustomerRef.get();
    
    if (!newCustomerDoc.exists) {
      return NextResponse.json({ 
        error: `Customer ${newCustomerId} not found` 
      }, { status: 404 });
    }
    
    const newCustomerData = newCustomerDoc.data();
    
    // Determine account type: use provided newAccountType, otherwise fall back to customer's account type
    const accountType = newAccountType || newCustomerData?.accountType || 'Retail';
    
    // Update order with new customer ID and account type
    batch.update(orderRef, {
      customerId: newCustomerId,
      customerName: newCustomerData?.name || orderData?.customerName,
      accountType: accountType,
      originalCustomerId: oldCustomerId,
      manuallyLinked: true,
      linkedAt: Timestamp.now(),
      linkedBy: correctedBy,
      linkedReason: reason,
      updatedAt: Timestamp.now()
    });
    
    // 2. Update line items with new customer ID
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
      .where('soNumber', '==', orderNumber)
      .get();
    
    lineItemsSnapshot.forEach(itemDoc => {
      batch.update(itemDoc.ref, {
        customerId: newCustomerId,
        customerName: newCustomerData?.name || orderData?.customerName,
        updatedAt: Timestamp.now()
      });
    });
    
    // 3. If rememberCorrection is true, add old ID as alias to customer
    if (rememberCorrection && oldCustomerId && oldCustomerId !== newCustomerId) {
      const currentAliases = newCustomerData?.aliases || [];
      
      // Only add if not already in aliases
      if (!currentAliases.includes(oldCustomerId)) {
        batch.update(newCustomerRef, {
          aliases: [...currentAliases, oldCustomerId],
          updatedAt: Timestamp.now()
        });
      }
    }
    
    // 4. Create audit log entry
    const auditRef = adminDb.collection('commission_audit_log').doc();
    batch.set(auditRef, {
      action: 'customer_correction',
      orderNumber: orderNumber,
      oldCustomerId: oldCustomerId,
      newCustomerId: newCustomerId,
      newCustomerName: newCustomerData?.name,
      accountType: accountType,
      accountTypeOverride: newAccountType ? true : false,
      rememberCorrection: rememberCorrection,
      reason: reason,
      correctedBy: correctedBy,
      timestamp: Timestamp.now()
    });
    
    // Commit all changes
    await batch.commit();
    
    console.log(`✅ Fixed order ${orderNumber}: ${oldCustomerId} → ${newCustomerId}`);
    if (rememberCorrection) {
      console.log(`   Added ${oldCustomerId} as alias for customer ${newCustomerId}`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Order ${orderNumber} updated successfully`,
      changes: {
        orderNumber,
        oldCustomerId,
        newCustomerId,
        newCustomerName: newCustomerData?.name,
        accountType: accountType,
        lineItemsUpdated: lineItemsSnapshot.size,
        aliasAdded: rememberCorrection
      }
    });
    
  } catch (error: any) {
    console.error('❌ Fix order customer error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fix order customer' 
    }, { status: 500 });
  }
}
