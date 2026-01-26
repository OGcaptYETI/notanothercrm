/**
 * Generic CRM React Hooks
 * Reusable hooks for People, Tasks, Opportunities, Leads
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { EntityType, EntityCounts } from './types-crm';
import type { FilterCondition } from './types';
import {
  getEntities,
  getEntityCounts,
  getPeople,
  getTasks,
  getOpportunities,
  getLeads,
  getPeopleCounts,
  getTaskCounts,
  getOpportunityCounts,
  getLeadCounts,
} from './supabaseCRMService';

// ============================================
// GENERIC HOOKS
// ============================================

/**
 * Generic hook for fetching any CRM entity with infinite scroll
 */
export function useCRMEntities<T>(
  entityType: EntityType,
  options: {
    search?: string;
    filterConditions?: FilterCondition[];
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    pageSize?: number;
  } = {}
) {
  return useInfiniteQuery({
    queryKey: ['crm', entityType, options],
    queryFn: ({ pageParam = 1 }) =>
      getEntities<T>(entityType, {
        page: pageParam,
        pageSize: options.pageSize || 50,
        search: options.search,
        filterConditions: options.filterConditions,
        sortBy: options.sortBy || 'name',
        sortDirection: options.sortDirection || 'asc',
      }),
    getNextPageParam: (lastPage, pages) => 
      lastPage.hasMore ? pages.length + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Generic hook for entity counts
 */
export function useCRMEntityCounts(
  entityType: EntityType,
  filterConditions?: FilterCondition[]
) {
  return useQuery<EntityCounts>({
    queryKey: ['crm', entityType, 'counts', filterConditions],
    queryFn: () => getEntityCounts(entityType, filterConditions),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// SPECIFIC ENTITY HOOKS
// ============================================

/**
 * Hook for fetching people/contacts
 */
export function usePeople(options: Parameters<typeof useCRMEntities>[1] = {}) {
  return useCRMEntities('people', options);
}

/**
 * Hook for people counts
 */
export function usePeopleCounts(filterConditions?: FilterCondition[]) {
  return useQuery({
    queryKey: ['crm', 'people', 'counts', filterConditions],
    queryFn: () => getPeopleCounts(filterConditions),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for fetching tasks
 */
export function useTasks(options: Parameters<typeof useCRMEntities>[1] = {}) {
  return useCRMEntities('tasks', options);
}

/**
 * Hook for task counts
 */
export function useTaskCounts(filterConditions?: FilterCondition[]) {
  return useQuery({
    queryKey: ['crm', 'tasks', 'counts', filterConditions],
    queryFn: () => getTaskCounts(filterConditions),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for fetching opportunities
 */
export function useOpportunities(options: Parameters<typeof useCRMEntities>[1] = {}) {
  return useCRMEntities('opportunities', options);
}

/**
 * Hook for opportunity counts
 */
export function useOpportunityCounts(filterConditions?: FilterCondition[]) {
  return useQuery({
    queryKey: ['crm', 'opportunities', 'counts', filterConditions],
    queryFn: () => getOpportunityCounts(filterConditions),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for fetching leads
 */
export function useLeads(options: Parameters<typeof useCRMEntities>[1] = {}) {
  return useCRMEntities('leads', options);
}

/**
 * Hook for lead counts
 */
export function useLeadCounts(filterConditions?: FilterCondition[]) {
  return useQuery({
    queryKey: ['crm', 'leads', 'counts', filterConditions],
    queryFn: () => getLeadCounts(filterConditions),
    staleTime: 5 * 60 * 1000,
  });
}
