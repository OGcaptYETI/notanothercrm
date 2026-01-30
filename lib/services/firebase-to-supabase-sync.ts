/**
 * Firebase to Supabase Sync Service
 * 
 * Syncs data from Firebase (business logic) to Supabase (CRM)
 * Triggered after Fishbowl imports to keep CRM accounts current
 */

import { adminDb } from '@/lib/firebase/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
  summary: string;
}

/**
 * Sync Fishbowl customers from Firebase to Supabase accounts
 * Maps Firebase fishbowl_customers → Supabase accounts table
 */
export async function syncCustomersToSupabase(
  companyId: string = 'kanva-botanicals'
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
    summary: ''
  };

  try {
    console.log('🔄 Starting Firebase → Supabase customer sync...');
    
    // Get all customers from Firebase
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    console.log(`📦 Found ${customersSnapshot.size} customers in Firebase`);

    // Process in batches to avoid overwhelming Supabase
    const batchSize = 50;
    const customers = customersSnapshot.docs;
    
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      // Map Firebase customers to Supabase accounts format
      const accountsToUpsert = batch.map(doc => {
        const customer = doc.data();
        
        return {
          // Identity (use Firebase doc ID as primary key)
          id: doc.id,
          company_id: companyId,
          source: 'fishbowl',
          
          // Core fields
          name: customer.name || customer.customerName || 'Unknown',
          account_number: customer.accountNumber || customer.customerNum || null,
          
          // Contact info
          email: customer.email || null,
          phone: customer.phone || customer.phoneNumber || null,
          website: customer.website || null,
          
          // Address (Supabase uses shipping_ prefix)
          shipping_street: customer.street || customer.address || null,
          shipping_city: customer.city || null,
          shipping_state: customer.state || null,
          shipping_zip: customer.postalCode || customer.zip || null,
          
          // Business classification
          account_type: customer.accountType ? [customer.accountType] : ['Wholesale'],
          segment: customer.segment || null,
          region: customer.region || null,
          customer_priority: customer.customerPriority || null,
          
          // Financial
          total_spent: customer.totalRevenue || 0,
          total_orders: customer.totalOrders || 0,
          payment_terms: customer.paymentTerms || customer.terms || null,
          
          // Sales
          sales_person: customer.salesPerson || null,
          
          // Status
          status: customer.isActive === false ? 'Inactive' : 'Active',
          is_active_customer: customer.isActive !== false,
          
          // Metadata
          fishbowl_id: customer.fishbowlId || customer.customerId || doc.id,
          
          // Dates (convert Firebase Timestamps to ISO strings)
          last_order_date: customer.lastOrderDate?.toDate ? customer.lastOrderDate.toDate().toISOString() : customer.lastOrderDate || null,
          updated_at: new Date().toISOString()
        };
      });

      // Upsert to Supabase (insert or update if exists)
      const { data, error } = await supabaseAdmin
        .from('accounts')
        .upsert(accountsToUpsert, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('❌ Batch sync error:', error);
        result.failed += batch.length;
        result.errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
      } else {
        result.synced += batch.length;
        console.log(`✅ Synced batch ${i / batchSize + 1}: ${batch.length} customers`);
      }
    }

    result.summary = `Synced ${result.synced} customers to Supabase accounts. ${result.failed} failed.`;
    console.log(`🎉 ${result.summary}`);

  } catch (error: any) {
    console.error('❌ Customer sync failed:', error);
    result.success = false;
    result.errors.push(error.message);
    result.summary = `Sync failed: ${error.message}`;
  }

  return result;
}

/**
 * Sync a single customer from Firebase to Supabase
 * Useful for real-time updates
 */
export async function syncSingleCustomer(
  customerId: string,
  companyId: string = 'kanva-botanicals'
): Promise<boolean> {
  try {
    const customerDoc = await adminDb
      .collection('fishbowl_customers')
      .doc(customerId)
      .get();

    if (!customerDoc.exists) {
      console.error(`Customer ${customerId} not found in Firebase`);
      return false;
    }

    const customer = customerDoc.data()!;

    const account = {
      id: customerDoc.id,
      company_id: companyId,
      source: 'fishbowl',
      name: customer.name || customer.customerName || 'Unknown',
      account_number: customer.accountNumber || customer.customerNum || null,
      email: customer.email || null,
      phone: customer.phone || customer.phoneNumber || null,
      website: customer.website || null,
      shipping_street: customer.street || customer.address || null,
      shipping_city: customer.city || null,
      shipping_state: customer.state || null,
      shipping_zip: customer.postalCode || customer.zip || null,
      account_type: customer.accountType ? [customer.accountType] : ['Wholesale'],
      segment: customer.segment || null,
      region: customer.region || null,
      customer_priority: customer.customerPriority || null,
      total_spent: customer.totalRevenue || 0,
      total_orders: customer.totalOrders || 0,
      payment_terms: customer.paymentTerms || customer.terms || null,
      sales_person: customer.salesPerson || null,
      status: customer.isActive === false ? 'Inactive' : 'Active',
      is_active_customer: customer.isActive !== false,
      fishbowl_id: customer.fishbowlId || customer.customerId || customerDoc.id,
      last_order_date: customer.lastOrderDate?.toDate ? customer.lastOrderDate.toDate().toISOString() : customer.lastOrderDate || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from('accounts')
      .upsert(account, { onConflict: 'id' });

    if (error) {
      console.error(`Failed to sync customer ${customerId}:`, error);
      return false;
    }

    console.log(`✅ Synced customer ${customerId} to Supabase`);
    return true;

  } catch (error) {
    console.error(`Error syncing customer ${customerId}:`, error);
    return false;
  }
}

/**
 * Get sync status and statistics
 */
export async function getSyncStatus(companyId: string = 'kanva-botanicals') {
  try {
    // Count Firebase customers
    const firebaseSnapshot = await adminDb.collection('fishbowl_customers').get();
    const firebaseCount = firebaseSnapshot.size;

    // Count Supabase accounts from Fishbowl (using admin client to bypass RLS)
    const { count: supabaseCount, error } = await supabaseAdmin
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('source', 'fishbowl');

    if (error) {
      console.error('Error getting Supabase count:', error);
      return null;
    }

    return {
      firebaseCustomers: firebaseCount,
      supabaseAccounts: supabaseCount || 0,
      needsSync: firebaseCount !== (supabaseCount || 0),
      difference: firebaseCount - (supabaseCount || 0)
    };

  } catch (error) {
    console.error('Error getting sync status:', error);
    return null;
  }
}
