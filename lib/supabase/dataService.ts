/**
 * Supabase Data Service
 * Handles all CRM data queries with Row Level Security
 */

import { supabase } from './client';
import type { FilterCondition } from '@/components/crm/FilterSidebar';

export interface SupabaseAccount {
  id: string;
  company_id: string;
  source: string;
  copper_id?: number;
  fishbowl_id?: string;
  name: string;
  account_number?: string;
  website?: string;
  phone?: string;
  email?: string;
  shipping_street?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_zip?: string;
  billing_street?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  account_type?: string[];
  region?: string;
  segment?: string;
  customer_priority?: string;
  organization_level?: string;
  business_model?: string;
  payment_terms?: string;
  shipping_terms?: string;
  carrier_name?: string;
  sales_person?: string;
  total_orders?: number;
  total_spent?: number;
  last_order_date?: string;
  first_order_date?: string;
  primary_contact_id?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  status: string;
  is_active_customer: boolean;
  created_at: string;
  updated_at: string;
  notes?: string;
}

/**
 * Build Supabase query with filters
 */
function buildSupabaseQuery(
  baseQuery: any,
  filters?: {
    searchTerm?: string;
    salesPerson?: string;
    region?: string;
    segment?: string;
    status?: string;
    filterConditions?: FilterCondition[];
  }
) {
  let query = baseQuery;

  // Search term (full-text search)
  if (filters?.searchTerm) {
    query = query.or(
      `name.ilike.%${filters.searchTerm}%,` +
      `email.ilike.%${filters.searchTerm}%,` +
      `phone.ilike.%${filters.searchTerm}%,` +
      `shipping_city.ilike.%${filters.searchTerm}%`
    );
  }

  // Sales person filter
  if (filters?.salesPerson) {
    query = query.eq('sales_person', filters.salesPerson);
  }

  // Region filter
  if (filters?.region) {
    query = query.eq('region', filters.region);
  }

  // Segment filter
  if (filters?.segment) {
    query = query.eq('segment', filters.segment);
  }

  // Status filter
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  // Advanced filter conditions
  if (filters?.filterConditions && filters.filterConditions.length > 0) {
    filters.filterConditions.forEach(condition => {
      const { field, operator, value } = condition;

      switch (operator) {
        case 'equals':
          query = query.eq(field, value);
          break;
        case 'notEquals':
          query = query.neq(field, value);
          break;
        case 'contains':
          query = query.ilike(field, `%${value}%`);
          break;
        case 'notContains':
          query = query.not(field, 'ilike', `%${value}%`);
          break;
        case 'startsWith':
          query = query.ilike(field, `${value}%`);
          break;
        case 'endsWith':
          query = query.ilike(field, `%${value}`);
          break;
        case 'greaterThan':
          query = query.gt(field, value);
          break;
        case 'lessThan':
          query = query.lt(field, value);
          break;
        case 'greaterThanOrEqual':
          query = query.gte(field, value);
          break;
        case 'lessThanOrEqual':
          query = query.lte(field, value);
          break;
        case 'isEmpty':
          query = query.is(field, null);
          break;
        case 'isNotEmpty':
          query = query.not(field, 'is', null);
          break;
        case 'in':
          if (Array.isArray(value)) {
            query = query.in(field, value);
          }
          break;
        case 'notIn':
          if (Array.isArray(value)) {
            query = query.not(field, 'in', value);
          }
          break;
      }
    });
  }

  return query;
}

/**
 * Load accounts with pagination and filters
 * RLS automatically filters by company_id
 */
export async function loadAccounts({
  pageSize = 50,
  cursor,
  filters,
}: {
  pageSize?: number;
  cursor?: string;
  filters?: {
    searchTerm?: string;
    salesPerson?: string;
    region?: string;
    segment?: string;
    status?: string;
    filterConditions?: FilterCondition[];
  };
} = {}) {
  try {
    // Start with base query - RLS automatically adds company_id filter
    let query = supabase
      .from('accounts')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .limit(pageSize);

    // Add cursor for pagination
    if (cursor) {
      query = query.gt('name', cursor);
    }

    // Apply filters
    query = buildSupabaseQuery(query, filters);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    return {
      accounts: data || [],
      total: count || 0,
      hasMore: (data?.length || 0) === pageSize,
      nextCursor: data && data.length > 0 ? data[data.length - 1].name : null,
    };
  } catch (error) {
    console.error('Error loading accounts:', error);
    throw error;
  }
}

/**
 * Get account counts by status
 */
export async function getAccountCounts() {
  try {
    const [allResult, activeResult, prospectResult] = await Promise.all([
      supabase.from('accounts').select('*', { count: 'exact', head: true }),
      supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('is_active_customer', true),
      supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('status', 'prospect'),
    ]);

    return {
      all: allResult.count || 0,
      active: activeResult.count || 0,
      prospects: prospectResult.count || 0,
    };
  } catch (error) {
    console.error('Error getting account counts:', error);
    return { all: 0, active: 0, prospects: 0 };
  }
}

/**
 * Get single account by ID
 */
export async function getAccountById(id: string) {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting account:', error);
    throw error;
  }
}

/**
 * Update account
 */
export async function updateAccount(id: string, updates: Partial<SupabaseAccount>) {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating account:', error);
    throw error;
  }
}

/**
 * Create new account
 */
export async function createAccount(account: Omit<SupabaseAccount, 'id' | 'company_id' | 'created_at' | 'updated_at'>) {
  try {
    // company_id is automatically set by RLS
    const { data, error } = await supabase
      .from('accounts')
      .insert([account])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating account:', error);
    throw error;
  }
}

/**
 * Delete account
 */
export async function deleteAccount(id: string) {
  try {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
}
