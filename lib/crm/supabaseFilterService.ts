/**
 * Supabase Filter Service - Handles filter persistence with Supabase
 * Replaces Firebase Firestore for saved filters
 */

import { supabase } from '@/lib/supabase/client';
import type { FilterCondition } from '@/components/crm/FilterSidebar';

export interface SavedFilter {
  id: string;
  name: string;
  isPublic: boolean;
  conditions: FilterCondition[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  count?: number;
  company_id?: string;
}

/**
 * Save a filter to Supabase
 * Gets company_id from current user's metadata
 */
export async function saveFilter(
  filter: Omit<SavedFilter, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const now = new Date().toISOString();
  
  // Get current user to extract company_id from metadata
  const { data: { user } } = await supabase.auth.getUser();
  const companyId = user?.user_metadata?.company_id;
  
  if (!companyId) {
    throw new Error('User does not have a company_id. Please contact support.');
  }
  
  // Generate a UUID for the filter ID
  const filterId = crypto.randomUUID();
  
  const { data, error } = await supabase
    .from('saved_filters')
    .insert({
      id: filterId,
      name: filter.name,
      is_public: filter.isPublic,
      conditions: filter.conditions,
      user_id: userId,
      company_id: companyId,
      created_at: now,
      updated_at: now,
      count: filter.count,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving filter:', error);
    throw error;
  }

  return data.id;
}

/**
 * Update an existing filter
 */
export async function updateFilter(
  filterId: string,
  updates: Partial<SavedFilter>
): Promise<void> {
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
  if (updates.conditions !== undefined) updateData.conditions = updates.conditions;
  if (updates.count !== undefined) updateData.count = updates.count;

  const { error } = await supabase
    .from('saved_filters')
    .update(updateData)
    .eq('id', filterId);

  if (error) {
    console.error('Error updating filter:', error);
    throw error;
  }
}

/**
 * Delete a filter
 */
export async function deleteFilter(filterId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_filters')
    .delete()
    .eq('id', filterId);

  if (error) {
    console.error('Error deleting filter:', error);
    throw error;
  }
}

/**
 * Load all filters (public + user's private filters)
 * RLS automatically filters by company_id from JWT
 */
export async function loadFilters(userId: string): Promise<SavedFilter[]> {
  if (!userId) {
    console.warn('No userId provided to loadFilters');
    return [];
  }

  // Get public filters and user's private filters in one query
  const { data, error } = await supabase
    .from('saved_filters')
    .select('*')
    .or(`is_public.eq.true,and(is_public.eq.false,user_id.eq.${userId})`)
    .order('name');

  if (error) {
    console.error('Error loading filters:', error);
    throw error;
  }

  return (data || []).map(mapSupabaseToFilter);
}

/**
 * Get a single filter by ID
 */
export async function getFilter(filterId: string): Promise<SavedFilter | null> {
  const { data, error } = await supabase
    .from('saved_filters')
    .select('*')
    .eq('id', filterId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error getting filter:', error);
    throw error;
  }

  return mapSupabaseToFilter(data);
}

/**
 * Convert Supabase filter to SavedFilter format
 */
function mapSupabaseToFilter(data: any): SavedFilter {
  return {
    id: data.id,
    name: data.name,
    isPublic: data.is_public,
    conditions: data.conditions || [],
    createdBy: data.user_id,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    count: data.count,
    company_id: data.company_id,
  };
}

/**
 * Apply client-side filters (same logic as before, works with any data source)
 */
export function applyClientSideFilters(
  data: any[],
  conditions: FilterCondition[]
): any[] {
  if (conditions.length === 0) return data;
  
  return data.filter(item => {
    // ALL conditions must pass (AND logic)
    for (const condition of conditions) {
      const fieldValue = item[condition.field];
      const { operator, value } = condition;

      // Handle empty/not empty
      if (operator === 'is_empty') {
        if (fieldValue != null && fieldValue !== '') return false;
        continue;
      }
      if (operator === 'is_not_empty') {
        if (fieldValue == null || fieldValue === '') return false;
        continue;
      }

      // Skip if no value for comparison operators
      if (!value && value !== 0 && value !== false) continue;

      // Apply operator
      switch (operator) {
        case 'equals':
          if (typeof fieldValue === 'string' && typeof value === 'string') {
            if (fieldValue.toLowerCase() !== value.toLowerCase()) return false;
          } else {
            if (fieldValue !== value) return false;
          }
          break;
          
        case 'not_equals':
          if (typeof fieldValue === 'string' && typeof value === 'string') {
            if (fieldValue.toLowerCase() === value.toLowerCase()) return false;
          } else {
            if (fieldValue === value) return false;
          }
          break;
          
        case 'contains':
          if (!fieldValue || typeof fieldValue !== 'string') return false;
          if (!fieldValue.toLowerCase().includes(value.toLowerCase())) return false;
          break;
          
        case 'starts_with':
          if (!fieldValue || typeof fieldValue !== 'string') return false;
          if (!fieldValue.toLowerCase().startsWith(value.toLowerCase())) return false;
          break;
          
        case 'greater_than':
          if (parseFloat(fieldValue) <= parseFloat(value)) return false;
          break;
          
        case 'less_than':
          if (parseFloat(fieldValue) >= parseFloat(value)) return false;
          break;
          
        case 'in':
          const values = typeof value === 'string' ? value.split(',').map(v => v.trim()) : [value];
          if (Array.isArray(fieldValue)) {
            if (!fieldValue.some(v => values.includes(v))) return false;
          } else {
            if (!values.includes(fieldValue)) return false;
          }
          break;
      }
    }
    return true;
  });
}
