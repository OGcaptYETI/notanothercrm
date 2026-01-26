/**
 * Supabase CRM Data Service
 * Replaces Firebase queries for CRM data (accounts, contacts, prospects, deals)
 * Uses Row Level Security for multi-tenant isolation
 */

import { supabase } from '@/lib/supabase/client';
import type { FilterCondition } from '@/components/crm/FilterSidebar';
import type { 
  UnifiedAccount, 
  PaginationOptions, 
  PaginatedResult 
} from './dataService';

/**
 * Build Supabase query with filters
 */
function applyFilters(query: any, filters?: PaginationOptions) {
  let q = query;

  // Search term (full-text search across multiple fields)
  if (filters?.searchTerm) {
    const term = filters.searchTerm;
    q = q.or(
      `name.ilike.%${term}%,` +
      `email.ilike.%${term}%,` +
      `phone.ilike.%${term}%,` +
      `shipping_city.ilike.%${term}%,` +
      `account_number.ilike.%${term}%`
    );
  }

  // Sales person filter
  if (filters?.salesPerson) {
    q = q.eq('sales_person', filters.salesPerson);
  }

  // Region filter
  if (filters?.region) {
    q = q.eq('region', filters.region);
  }

  // Segment filter
  if (filters?.segment) {
    q = q.eq('segment', filters.segment);
  }

  // Status filter
  if (filters?.status) {
    if (filters.status === 'active') {
      q = q.eq('is_active_customer', true);
    } else if (filters.status === 'prospect') {
      q = q.eq('is_active_customer', false);
    }
  }

  // Advanced filter conditions
  if (filters?.filterConditions && filters.filterConditions.length > 0) {
    filters.filterConditions.forEach((condition: FilterCondition) => {
      let { field, operator, value } = condition;

      // Convert camelCase field names to snake_case for Supabase
      const fieldMap: Record<string, string> = {
        isActiveCustomer: 'is_active_customer',
        fishbowlId: 'fishbowl_id',
        copperId: 'copper_id',
        accountNumber: 'account_number',
        accountType: 'account_type',
        customerPriority: 'customer_priority',
        organizationLevel: 'organization_level',
        businessModel: 'business_model',
        paymentTerms: 'payment_terms',
        shippingTerms: 'shipping_terms',
        carrierName: 'carrier_name',
        salesPerson: 'sales_person',
        totalOrders: 'total_orders',
        totalSpent: 'total_spent',
        lastOrderDate: 'last_order_date',
        firstOrderDate: 'first_order_date',
        primaryContactId: 'primary_contact_id',
        primaryContactName: 'primary_contact_name',
        primaryContactEmail: 'primary_contact_email',
        primaryContactPhone: 'primary_contact_phone',
        accountOrderId: 'account_order_id',
        copperUrl: 'copper_url',
        contactType: 'contact_type',
        inactiveDays: 'inactive_days',
        interactionCount: 'interaction_count',
        lastContacted: 'last_contacted',
        ownedBy: 'owned_by',
        ownerId: 'owner_id',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        shippingStreet: 'shipping_street',
        shippingCity: 'shipping_city',
        shippingState: 'shipping_state',
        shippingZip: 'shipping_zip',
        billingStreet: 'billing_street',
        billingCity: 'billing_city',
        billingState: 'billing_state',
        billingZip: 'billing_zip',
      };
      
      const dbField = fieldMap[field] || field;
      
      // Convert boolean display values to actual booleans
      let dbValue = value;
      if (value === 'Yes' || value === 'yes') dbValue = true;
      if (value === 'No' || value === 'no') dbValue = false;

      switch (operator) {
        case 'equals':
          q = q.eq(dbField, dbValue);
          break;
        case 'not_equals':
          q = q.neq(dbField, dbValue);
          break;
        case 'contains':
          q = q.ilike(dbField, `%${dbValue}%`);
          break;
        case 'starts_with':
          q = q.ilike(dbField, `${dbValue}%`);
          break;
        case 'greater_than':
          q = q.gt(dbField, dbValue);
          break;
        case 'less_than':
          q = q.lt(dbField, dbValue);
          break;
        case 'is_empty':
          q = q.is(dbField, null);
          break;
        case 'is_not_empty':
          q = q.not(dbField, 'is', null);
          break;
        case 'in':
          if (Array.isArray(dbValue)) {
            q = q.in(dbField, dbValue);
          }
          break;
      }
    });
  }

  return q;
}

/**
 * Convert Supabase account to UnifiedAccount format
 */
function mapSupabaseToUnified(account: any): UnifiedAccount {
  return {
    id: account.id,
    name: account.name || 'Unknown',
    email: account.email || undefined,
    phone: account.phone || undefined,
    website: account.website || undefined,
    
    // Address
    street: account.shipping_street || undefined,
    city: account.shipping_city || undefined,
    state: account.shipping_state || undefined,
    zip: account.shipping_zip || undefined,
    
    // CRM fields
    accountNumber: account.account_number || undefined,
    accountType: account.account_type || undefined,
    region: account.region || undefined,
    segment: account.segment || undefined,
    customerPriority: account.customer_priority || undefined,
    organizationLevel: account.organization_level || undefined,
    businessModel: account.business_model || undefined,
    paymentTerms: account.payment_terms || undefined,
    shippingTerms: account.shipping_terms || undefined,
    carrierName: account.carrier_name || undefined,
    
    // Sales data
    salesPerson: account.sales_person || undefined,
    totalOrders: account.total_orders || 0,
    totalSpent: account.total_spent || 0,
    lastOrderDate: account.last_order_date || undefined,
    firstOrderDate: account.first_order_date || undefined,
    
    // Contact info
    primaryContactId: account.primary_contact_id || undefined,
    primaryContactName: account.primary_contact_name || undefined,
    primaryContactEmail: account.primary_contact_email || undefined,
    primaryContactPhone: account.primary_contact_phone || undefined,
    
    // Status
    status: account.status || 'prospect',
    isActiveCustomer: account.is_active_customer || false,
    
    // Metadata
    source: account.source || 'supabase',
    copperId: account.copper_id || undefined,
    fishbowlId: account.fishbowl_id || undefined,
    notes: account.notes || undefined,
    
    // Timestamps
    createdAt: account.created_at,
    updatedAt: account.updated_at,
  };
}

/**
 * Load accounts with pagination and filters
 * RLS automatically filters by company_id from JWT
 */
export async function loadUnifiedAccountsFromSupabase(
  options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedAccount>> {
  try {
    const pageSize = options.pageSize || 50;
    
    // Start with base query - RLS automatically adds company_id filter from JWT
    let query = supabase
      .from('accounts')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .limit(pageSize);

    // Add cursor for pagination
    if (options.cursor) {
      query = query.gt('name', options.cursor);
    }

    // Apply filters
    query = applyFilters(query, options);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    const accounts = (data || []).map(mapSupabaseToUnified);
    const hasMore = accounts.length === pageSize;
    const nextCursor = hasMore && accounts.length > 0 
      ? accounts[accounts.length - 1].name 
      : undefined;

    return {
      data: accounts,
      total: count || 0,
      hasMore,
      nextCursor,
    };
  } catch (error) {
    console.error('Error loading accounts from Supabase:', error);
    throw error;
  }
}

/**
 * Get account counts by status
 * RLS automatically filters by company_id from JWT
 */
export async function getAccountCountsFromSupabase(filterConditions?: FilterCondition[]) {
  try {
    // Base query for total with optional filters
    let totalQuery = supabase.from('accounts').select('*', { count: 'exact', head: true });
    if (filterConditions && filterConditions.length > 0) {
      totalQuery = applyFilters(totalQuery, { filterConditions });
    }
    
    const [totalResult, activeResult, fishbowlResult] = await Promise.all([
      totalQuery,
      supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('is_active_customer', true),
      supabase.from('accounts').select('*', { count: 'exact', head: true }).not('fishbowl_id', 'is', null),
    ]);

    return {
      total: totalResult.count || 0,
      active: activeResult.count || 0,
      fishbowl: fishbowlResult.count || 0,
    };
  } catch (error) {
    console.error('Error getting account counts:', error);
    return { total: 0, active: 0, fishbowl: 0 };
  }
}

/**
 * Get single account by ID
 * RLS automatically filters by company_id from JWT
 */
export async function loadAccountFromSupabase(accountId: string): Promise<UnifiedAccount | null> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw error;
    }

    return data ? mapSupabaseToUnified(data) : null;
  } catch (error) {
    console.error('Error loading account:', error);
    return null;
  }
}
