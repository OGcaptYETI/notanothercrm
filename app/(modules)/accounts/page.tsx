'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useInfiniteAccounts, useRefreshCRMData, useAccountCounts } from '@/lib/crm/hooks';
import { DataTable } from '@/components/crm/DataTable';
import { MergeAccountsDialog } from '@/components/crm/MergeAccountsDialog';
import { SavedFiltersPanel } from '@/components/crm/SavedFiltersPanel';
import { FilterSidebar, type FilterCondition } from '@/components/crm/FilterSidebar';
import type { UnifiedAccount } from '@/lib/crm/dataService';
import { saveFilter, loadFilters, type SavedFilter } from '@/lib/crm/filterService';
import { 
  Plus,
  Search,
  Filter,
  SortDesc,
  Zap,
  Building2,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  ShoppingCart,
  MoreVertical,
  GitMerge,
} from 'lucide-react';

export default function AccountsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // Filter and UI state
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  const [activeFilterId, setActiveFilterId] = useState<string | null>('all');
  const [activeFilterConditions, setActiveFilterConditions] = useState<FilterCondition[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [mainSidebarCollapsed, setMainSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Listen for main sidebar toggle events
  useEffect(() => {
    const handleSidebarToggle = (e: CustomEvent) => {
      setMainSidebarCollapsed(e.detail.isCollapsed);
    };
    window.addEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
    return () => window.removeEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
  }, []);
  
  const { 
    data, 
    isLoading, 
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteAccounts({ pageSize: 50 });
  const { data: counts } = useAccountCounts();
  const { refreshAccounts } = useRefreshCRMData();
  
  // Flatten all pages into single array (memoized to prevent callback deps changes)
  const accounts = useMemo(() => 
    data?.pages.flatMap(page => page.data) || [], 
    [data]
  );
  const totalAccounts = counts?.total || 0;
  const activeAccounts = counts?.active || 0;
  const fishbowlAccounts = counts?.fishbowl || 0;
  
  // Selection state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  
  // Load saved filters from Firestore
  useEffect(() => {
    if (!user) return;
    
    const fetchFilters = async () => {
      try {
        setLoadingFilters(true);
        const filters = await loadFilters(user.uid);
        setSavedFilters(filters);
      } catch (error) {
        console.error('Error loading filters:', error);
      } finally {
        setLoadingFilters(false);
      }
    };
    
    fetchFilters();
  }, [user]);
  
  // Separate public and private filters
  const publicFilters = savedFilters.filter(f => f.isPublic);
  const privateFilters = savedFilters.filter(f => !f.isPublic);
  
  const selectedAccounts = accounts.filter(a => selectedAccountIds.includes(a.id));
  const allSelected = accounts.length > 0 && selectedAccountIds.length === accounts.length;
  const someSelected = selectedAccountIds.length > 0 && selectedAccountIds.length < accounts.length;
  
  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(accounts.map(a => a.id));
    }
  }, [allSelected, accounts]);
  
  const toggleSelectAccount = useCallback((accountId: string) => {
    setSelectedAccountIds(prev => 
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  }, []);
  
  const handleMergeComplete = () => {
    setSelectedAccountIds([]);
    refreshAccounts();
  };
  
  const handleFilterSave = async (filter: { name: string; isPublic: boolean; conditions: FilterCondition[] }) => {
    if (!user) return;
    
    try {
      const filterId = await saveFilter({
        name: filter.name,
        isPublic: filter.isPublic,
        conditions: filter.conditions,
        createdBy: user.uid,
      }, user.uid);
      
      // Reload filters
      const filters = await loadFilters(user.uid);
      setSavedFilters(filters);
      
      // Apply the new filter
      setActiveFilterId(filterId);
      setActiveFilterConditions(filter.conditions);
      setFilterSidebarOpen(false);
    } catch (error) {
      console.error('Error saving filter:', error);
      alert('Failed to save filter. Please try again.');
    }
  };
  
  const handleFilterSelect = (filterId: string) => {
    setActiveFilterId(filterId);
    
    if (filterId === 'all') {
      setActiveFilterConditions([]);
      return;
    }
    
    // Find the filter and apply its conditions
    const filter = savedFilters.find(f => f.id === filterId);
    if (filter) {
      setActiveFilterConditions(filter.conditions);
    }
  };

  // Define table columns
  const columns = useMemo<ColumnDef<UnifiedAccount, any>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = someSelected;
            }}
            onChange={toggleSelectAll}
            className="w-4 h-4 text-[#93D500] border-gray-300 rounded focus:ring-[#93D500]"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedAccountIds.includes(row.original.id)}
            onChange={(e) => {
              e.stopPropagation();
              toggleSelectAccount(row.original.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-[#93D500] border-gray-300 rounded focus:ring-[#93D500]"
          />
        ),
        size: 40,
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Account Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/accounts/${row.original.id}`);
              }}
              className="font-medium text-primary-600 hover:text-primary-700 hover:underline text-left truncate"
            >
              {row.original.name}
            </button>
          </div>
        ),
      },
      {
        id: 'accountNumber',
        accessorKey: 'accountNumber',
        header: 'Account #',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const colors: Record<string, string> = {
            active: 'bg-green-100 text-green-700',
            inactive: 'bg-gray-100 text-gray-600',
            prospect: 'bg-blue-100 text-blue-700',
            churned: 'bg-red-100 text-red-700',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
              {status}
            </span>
          );
        },
      },
      {
        id: 'source',
        accessorKey: 'source',
        header: 'Source',
        cell: ({ getValue }) => {
          const source = getValue() as string;
          const colors: Record<string, string> = {
            fishbowl: 'bg-purple-100 text-purple-700',
            copper: 'bg-orange-100 text-orange-700',
            manual: 'bg-gray-100 text-gray-600',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[source] || 'bg-gray-100'}`}>
              {source}
            </span>
          );
        },
      },
      {
        id: 'phone',
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ getValue }) => {
          const phone = getValue() as string;
          return phone ? (
            <a href={`tel:${phone}`} className="flex items-center gap-1 text-gray-600 hover:text-[#93D500]">
              <Phone className="w-3.5 h-3.5" />
              {phone}
            </a>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => {
          const email = getValue() as string;
          return email ? (
            <a href={`mailto:${email}`} className="flex items-center gap-1 text-gray-600 hover:text-[#93D500] truncate max-w-[200px]">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{email}</span>
            </a>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'location',
        accessorFn: (row) => `${row.shippingCity || ''} ${row.shippingState || ''}`.trim(),
        header: 'Location',
        cell: ({ row }) => {
          const city = row.original.shippingCity;
          const state = row.original.shippingState;
          return city || state ? (
            <div className="flex items-center gap-1 text-gray-600">
              <MapPin className="w-3.5 h-3.5" />
              {city && `${city}, `}{state}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'region',
        accessorKey: 'region',
        header: 'Region',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'segment',
        accessorKey: 'segment',
        header: 'Segment',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'accountType',
        accessorKey: 'accountType',
        header: 'Type',
        cell: ({ getValue }) => {
          const types = getValue() as string[] | undefined;
          return types?.length ? (
            <div className="flex flex-wrap gap-1">
              {types.slice(0, 2).map((t, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{t}</span>
              ))}
              {types.length > 2 && (
                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">+{types.length - 2}</span>
              )}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'salesPerson',
        accessorKey: 'salesPerson',
        header: 'Sales Rep',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'totalOrders',
        accessorKey: 'totalOrders',
        header: 'Orders',
        cell: ({ getValue }) => {
          const orders = getValue() as number | undefined;
          return orders !== undefined ? (
            <div className="flex items-center gap-1 text-gray-600">
              <ShoppingCart className="w-3.5 h-3.5" />
              {orders.toLocaleString()}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'totalSpent',
        accessorKey: 'totalSpent',
        header: 'Total Spent',
        cell: ({ getValue }) => {
          const spent = getValue() as number | undefined;
          return spent !== undefined ? (
            <div className="flex items-center gap-1 text-gray-700 font-medium">
              <DollarSign className="w-3.5 h-3.5" />
              {spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'paymentTerms',
        accessorKey: 'paymentTerms',
        header: 'Payment Terms',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'customerPriority',
        accessorKey: 'customerPriority',
        header: 'Priority',
        cell: ({ getValue }) => {
          const priority = getValue() as string;
          if (!priority) return <span className="text-gray-400">-</span>;
          const colors: Record<string, string> = {
            '1': 'bg-red-100 text-red-700',
            '2': 'bg-orange-100 text-orange-700',
            '3': 'bg-yellow-100 text-yellow-700',
            '4': 'bg-blue-100 text-blue-700',
            '5': 'bg-gray-100 text-gray-600',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority] || 'bg-gray-100'}`}>
              P{priority}
            </span>
          );
        },
      },
    ],
    [allSelected, someSelected, toggleSelectAll, selectedAccountIds, toggleSelectAccount, router]
  );

  // Handle row click - navigate to account detail
  const handleRowClick = (account: UnifiedAccount) => {
    router.push(`/accounts/${account.id}`);
  };

  // Infinite scroll - load more when near bottom
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          console.log('📄 Loading next page...');
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Auth check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#93D500]"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div 
      className="fixed inset-0 flex overflow-hidden bg-gray-50 transition-all duration-300"
      style={{ 
        top: '64px',
        left: mainSidebarCollapsed ? '64px' : '256px'
      }}
    >
      {/* Saved Filters Panel */}
      <SavedFiltersPanel
        isCollapsed={filtersCollapsed}
        onToggle={() => setFiltersCollapsed(!filtersCollapsed)}
        onFilterSelect={handleFilterSelect}
        onNewFilter={() => setFilterSidebarOpen(true)}
        activeFilterId={activeFilterId}
        publicFilters={publicFilters}
        privateFilters={privateFilters}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {activeFilterId === 'all' ? 'All Accounts' : publicFilters.concat(privateFilters).find(f => f.id === activeFilterId)?.name || 'Accounts'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {totalAccounts.toLocaleString()} total accounts
                <span className="text-gray-400 mx-2">•</span>
                Fishbowl: <span className="font-medium text-[#93D500]">{fishbowlAccounts.toLocaleString()}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Data Table Container */}
        <div className="flex-1 overflow-hidden relative">
          {/* Filter Sidebar */}
          <FilterSidebar
            isOpen={filterSidebarOpen}
            onClose={() => setFilterSidebarOpen(false)}
            onSave={handleFilterSave}
          />
          
          <div className="h-full overflow-auto bg-white">
        <DataTable
          data={accounts}
          columns={columns}
          loading={isLoading}
          onRowClick={handleRowClick}
          tableId="accounts"
          searchPlaceholder="Search accounts by name, email, phone, location..."
          leftToolbarActions={
            <>
              <button
                onClick={() => setFilterSidebarOpen(true)}
                className={`p-2 hover:bg-gray-100 rounded-md transition-colors relative ${
                  activeFilterId !== 'all' ? 'text-[#93D500]' : 'text-gray-600'
                }`}
                title="Filter"
              >
                <Filter className="w-4 h-4" />
                {activeFilterId !== 'all' && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#93D500] rounded-full"></span>
                )}
              </button>
              <button
                onClick={() => console.log('Sort')}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
                title="Sort"
              >
                <SortDesc className="w-4 h-4" />
              </button>
              <button
                onClick={() => console.log('Automation')}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
                title="Automation"
              >
                <Zap className="w-4 h-4" />
              </button>
            </>
          }
          rightToolbarActions={
            <button
              onClick={() => router.push('/accounts/new')}
              className="px-4 py-2 bg-[#93D500] text-white rounded-md hover:bg-[#84c000] flex items-center gap-2 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          }
          toolbarActions={
          selectedAccountIds.length > 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium text-blue-900">
                {selectedAccountIds.length} selected
              </span>
              <div className="relative">
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className="p-1.5 hover:bg-blue-100 rounded-md transition-colors"
                  title="Actions"
                >
                  <MoreVertical className="w-4 h-4 text-blue-700" />
                </button>
                {showActionsMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowActionsMenu(false)}
                    />
                    <div className="absolute left-0 mt-2 w-52 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                      <button
                        onClick={() => {
                          if (selectedAccountIds.length >= 2) {
                            setShowMergeDialog(true);
                            setShowActionsMenu(false);
                          } else {
                            alert('Please select at least 2 accounts to merge');
                          }
                        }}
                        disabled={selectedAccountIds.length < 2}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <GitMerge className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-900">Merge Accounts</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : undefined
        }
      />
        
          {/* Infinite Scroll Load More Trigger */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#93D500]"></div>
                  <span className="text-sm">Loading more accounts...</span>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
      
      {/* Merge Dialog */}
      {showMergeDialog && user && (
        <MergeAccountsDialog
          accounts={selectedAccounts}
          onClose={() => setShowMergeDialog(false)}
          onMergeComplete={handleMergeComplete}
          userId={user.uid}
        />
      )}
    </div>
  );
}
