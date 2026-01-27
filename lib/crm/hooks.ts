'use client';

import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  loadUnifiedAccounts,
  loadUnifiedProspects,
  loadUnifiedContacts,
  loadUnifiedDeals,
  loadAccountOrders,
  loadAccountSalesSummary,
  loadAccountFromCopper,
  getTotalAccountsCount,
  getTotalContactsCount,
  type UnifiedAccount,
  type UnifiedProspect,
  type UnifiedContact,
  type UnifiedDeal,
  type OrderSummary,
  type SalesSummary,
  type PaginationOptions,
  type PaginatedResult,
} from './dataService';

// Import Supabase data service for CRM data
import {
  loadUnifiedAccountsFromSupabase,
  getAccountCountsFromSupabase,
  loadAccountFromSupabase,
} from './supabaseDataService';

// Import new Supabase CRM hooks
import {
  usePeople as useSupabasePeople,
  usePeopleCounts as useSupabasePeopleCounts,
  useLeads as useSupabaseLeads,
  useLeadCounts as useSupabaseLeadCounts,
  useOpportunities as useSupabaseOpportunities,
  useOpportunityCounts as useSupabaseOpportunityCounts,
  useTasks as useSupabaseTasks,
  useTaskCounts as useSupabaseTaskCounts,
} from './hooks-crm';
import type { Person, Lead, Opportunity, Task } from './types-crm';

// Query keys for cache management
export const queryKeys = {
  accounts: ['crm', 'accounts'] as const,
  prospects: ['crm', 'prospects'] as const,
  contacts: ['crm', 'contacts'] as const,
  deals: ['crm', 'deals'] as const,
  accountOrders: (accountId: string) => ['crm', 'orders', accountId] as const,
  accountSales: (accountId: string) => ['crm', 'sales', accountId] as const,
};

// Hook for loading accounts with pagination
export function useAccounts(options?: PaginationOptions) {
  return useQuery({
    queryKey: [...queryKeys.accounts, options],
    queryFn: () => loadUnifiedAccounts(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook for infinite scroll accounts loading (using Supabase)
export function useInfiniteAccounts(options?: Omit<PaginationOptions, 'offset'>) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.accounts, 'infinite', 'supabase', options],
    queryFn: ({ pageParam }) => loadUnifiedAccountsFromSupabase({ ...options, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook for getting total account counts (using Supabase)
export function useAccountCounts(filterConditions?: any[]) {
  return useQuery({
    queryKey: ['crm', 'accounts', 'counts', 'supabase', filterConditions],
    queryFn: () => getAccountCountsFromSupabase(filterConditions),
    staleTime: 5 * 60 * 1000, // 5 minutes - shorter for filtered counts
  });
}

// Hook for loading all prospects with caching
export function useProspects(options: PaginationOptions = {}) {
  return useQuery({
    queryKey: [...queryKeys.prospects, options],
    queryFn: () => loadUnifiedProspects(options),
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for loading contacts with pagination
export function useContacts(options?: PaginationOptions) {
  return useQuery({
    queryKey: [...queryKeys.contacts, options],
    queryFn: () => loadUnifiedContacts(options),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook for getting total contact counts
export function useContactCounts() {
  return useQuery({
    queryKey: ['crm', 'contacts', 'counts'],
    queryFn: getTotalContactsCount,
    staleTime: 10 * 60 * 1000,
  });
}

// Hook for loading all deals with caching
export function useDeals() {
  return useQuery<UnifiedDeal[]>({
    queryKey: queryKeys.deals,
    queryFn: loadUnifiedDeals,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for loading orders for a specific account
export function useAccountOrders(accountId: string | null) {
  return useQuery<OrderSummary[]>({
    queryKey: queryKeys.accountOrders(accountId || ''),
    queryFn: () => loadAccountOrders(accountId || ''),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for loading sales summary for a specific account
export function useAccountSales(accountId: string | null) {
  return useQuery<SalesSummary | null>({
    queryKey: queryKeys.accountSales(accountId || ''),
    queryFn: () => loadAccountSalesSummary(accountId || ''),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to get a single account by ID (using Supabase)
export function useAccount(accountId: string | null) {
  return useQuery<UnifiedAccount | null>({
    queryKey: ['crm', 'account', 'supabase', accountId],
    queryFn: () => loadAccountFromSupabase(accountId || ''),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to get contacts for a specific account with primary contact marked
export function useAccountContacts(accountId: string | null) {
  const { data: contactsData } = useContacts();
  const { data: account } = useAccount(accountId);
  
  if (!accountId || !contactsData?.data) return [];
  
  // Match contacts by either:
  // 1. accountId matches the Firestore document ID (accountId)
  // 2. copperId_company matches the account's copperId (for Copper accounts)
  const accountContacts = contactsData.data.filter((c: UnifiedContact) => {
    // Direct match by Firestore document ID
    if (c.accountId === accountId) return true;
    
    // Match by Copper company ID if account is from Copper
    if (account?.copperId && c.copperId_company === account.copperId) return true;
    
    return false;
  });
  
  // Mark primary contact
  return accountContacts.map((c: UnifiedContact) => ({
    ...c,
    isPrimaryContact: c.id === account?.primaryContactId
  }));
}

// Hook to prefetch data (call on app mount for instant loading)
export function usePrefetchCRMData() {
  const queryClient = useQueryClient();

  const prefetch = async () => {
    // Prefetch all CRM data in parallel
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.accounts,
        queryFn: () => loadUnifiedAccounts({ pageSize: 50 }),
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.prospects,
        queryFn: () => loadUnifiedProspects({ pageSize: 50 }),
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.contacts,
        queryFn: () => loadUnifiedContacts({ pageSize: 50 }),
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.deals,
        queryFn: loadUnifiedDeals,
        staleTime: 5 * 60 * 1000,
      }),
    ]);
  };

  return prefetch;
}

// Hook to invalidate and refetch data
export function useRefreshCRMData() {
  const queryClient = useQueryClient();

  return {
    refreshAccounts: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
    refreshProspects: () => queryClient.invalidateQueries({ queryKey: queryKeys.prospects }),
    refreshContacts: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    refreshDeals: () => queryClient.invalidateQueries({ queryKey: queryKeys.deals }),
    refreshAll: () => queryClient.invalidateQueries({ queryKey: ['crm'] }),
  };
}

// ============================================
// SUPABASE-POWERED HOOKS (Mapped to existing interfaces)
// ============================================

// Map Supabase Person to UnifiedContact
function mapPersonToContact(person: Person): UnifiedContact {
  const firstName = person.first_name || '';
  const lastName = person.last_name || '';
  return {
    id: person.id,
    source: (person.source === 'copper' ? 'copper_person' : 'manual') as 'copper_person' | 'manual',
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim() || person.name,
    email: person.email || '',
    phone: person.phone || '',
    title: person.title || '',
    accountId: person.account_id || '',
    accountName: person.company_name || '',
    copperId: person.copper_id || 0,
    copperId_company: person.company_id ? parseInt(person.company_id) : 0,
    city: person.city || '',
    state: person.state || '',
    createdAt: new Date(person.created_at),
    updatedAt: new Date(person.updated_at),
    isPrimaryContact: false,
  };
}

// Map Supabase Lead to UnifiedProspect
function mapLeadToProspect(lead: Lead): UnifiedProspect {
  return {
    id: lead.id,
    source: (lead.source === 'copper' ? 'copper_lead' : 'manual') as 'copper_lead' | 'manual',
    name: lead.name,
    companyName: lead.company || '',
    title: lead.title || '',
    email: lead.email || '',
    phone: lead.phone || '',
    status: lead.status || 'new',
    leadTemperature: lead.lead_temperature || '',
    city: lead.city || '',
    state: lead.state || '',
    region: lead.region || '',
    segment: lead.segment || '',
    accountType: lead.account_type ? [lead.account_type] : [],
    followUpDate: lead.follow_up_date ? new Date(lead.follow_up_date) : undefined,
    tradeShowName: lead.details || '',
    copperId: lead.copper_id || 0,
    createdAt: new Date(lead.created_at),
    updatedAt: new Date(lead.updated_at),
  };
}

// Updated useContacts hook using Supabase
export function useContactsFromSupabase(options?: { pageSize?: number }) {
  const supabaseQuery = useSupabasePeople(options);
  
  return {
    ...supabaseQuery,
    data: {
      data: supabaseQuery.data?.pages.flatMap(page => 
        page.data.map(mapPersonToContact)
      ) || [],
      total: 0,
    }
  };
}

// Updated useContactCounts hook using Supabase
export function useContactCountsFromSupabase() {
  return useSupabasePeopleCounts();
}

// Updated useProspects hook using Supabase
export function useProspectsFromSupabase(options?: { pageSize?: number }) {
  const supabaseQuery = useSupabaseLeads(options);
  
  return {
    ...supabaseQuery,
    data: {
      data: supabaseQuery.data?.pages.flatMap(page => 
        page.data.map(mapLeadToProspect)
      ) || [],
      total: 0,
    }
  };
}

// Export Supabase hooks directly for new pages
export { useSupabasePeople, useSupabasePeopleCounts, useSupabaseLeads, useSupabaseLeadCounts, useSupabaseOpportunities, useSupabaseOpportunityCounts, useSupabaseTasks, useSupabaseTaskCounts };
