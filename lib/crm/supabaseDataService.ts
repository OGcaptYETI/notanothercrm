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
      const { field, operator, value } = condition;

      switch (operator) {
        case 'equals':
          q = q.eq(field, value);
          break;
        case 'not_equals':
          q = q.neq(field, value);
          break;
        case 'contains':
          q = q.ilike(field, `%${value}%`);
          break;
        case 'starts_with':
          q = q.ilike(field, `${value}%`);
          break;
        case 'greater_than':
          q = q.gt(field, value);
          break;
        case 'less_than':
          q = q.lt(field, value);
          break;
        case 'is_empty':
          q = q.is(field, null);
          break;
        case 'is_not_empty':
          q = q.not(field, 'is', null);
          break;
        case 'in':
          if (Array.isArray(value)) {
            q = q.in(field, value);
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
export async function getAccountCountsFromSupabase() {
  try {
    const [totalResult, activeResult, fishbowlResult] = await Promise.all([
      supabase.from('accounts').select('*', { count: 'exact', head: true }),
      supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('is_active_customer', true),
      supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('source', 'fishbowl'),
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
