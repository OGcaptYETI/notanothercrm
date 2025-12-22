'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadUnifiedAccounts,
  loadUnifiedProspects,
  loadUnifiedContacts,
  loadUnifiedDeals,
  loadAccountOrders,
  loadAccountSalesSummary,
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

// Hook for getting total account counts
export function useAccountCounts() {
  return useQuery({
    queryKey: ['crm', 'accounts', 'counts'],
    queryFn: getTotalAccountsCount,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook for loading all prospects with caching
export function useProspects() {
  return useQuery<UnifiedProspect[]>({
    queryKey: queryKeys.prospects,
    queryFn: loadUnifiedProspects,
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

// Hook to get a single account by ID (uses cached data)
export function useAccount(accountId: string | null) {
  const { data } = useAccounts();
  return data?.data?.find((a: UnifiedAccount) => a.id === accountId) || null;
}

// Hook to get contacts for a specific account with primary contact marked
export function useAccountContacts(accountId: string | null) {
  const { data } = useContacts();
  const account = useAccount(accountId);
  
  if (!accountId || !data?.data) return [];
  
  const accountContacts = data.data.filter((c: UnifiedContact) => c.accountId === accountId);
  
  // Mark primary contact if account has primaryContactId
  if (account?.primaryContactId) {
    return accountContacts.map((c: UnifiedContact) => ({
      ...c,
      isPrimaryContact: c.copperId?.toString() === account.primaryContactId
    }));
  }
  
  return accountContacts;
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
        queryFn: loadUnifiedProspects,
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
