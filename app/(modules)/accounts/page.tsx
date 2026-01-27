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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { UnifiedAccount } from '@/lib/crm/dataService';
import { saveFilter, loadFilters, deleteFilter, updateFilter, type SavedFilter } from '@/lib/crm/supabaseFilterService';
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
  const [editingFilter, setEditingFilter] = useState<{ id: string; name: string; isPublic: boolean; conditions: FilterCondition[] } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [filterToDelete, setFilterToDelete] = useState<{ id: string; name: string } | null>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'name', direction: 'asc' });
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
  } = useInfiniteAccounts({ 
    pageSize: 50,
    filterConditions: activeFilterConditions 
  });
  const { data: counts } = useAccountCounts(activeFilterConditions);
  const { refreshAccounts } = useRefreshCRMData();
  
  // Flatten all pages into single array and apply sorting
  const accounts = useMemo(() => {
    const flatAccounts = data?.pages.flatMap(page => page.data) || [];
    
    // Apply client-side sorting
    return flatAccounts.sort((a, b) => {
      const aValue = a[sortBy.field as keyof UnifiedAccount];
      const bValue = b[sortBy.field as keyof UnifiedAccount];
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      // Compare values
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        // Date or other types - convert to string for comparison
        comparison = String(aValue).localeCompare(String(bValue));
      }
      
      return sortBy.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortBy]);
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
        const filters = await loadFilters(user.id);
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
      if (editingFilter) {
        // Update existing filter
        await updateFilter(editingFilter.id, {
          name: filter.name,
          isPublic: filter.isPublic,
          conditions: filter.conditions,
        });
        
        // Reload filters
        const filters = await loadFilters(user.id);
        setSavedFilters(filters);
        
        // Keep the filter active if it was already active
        if (activeFilterId === editingFilter.id) {
          setActiveFilterConditions(filter.conditions);
        }
        
        setEditingFilter(null);
      } else {
        // Create new filter
        const filterId = await saveFilter({
          name: filter.name,
          isPublic: filter.isPublic,
          conditions: filter.conditions,
          createdBy: user.id,
        }, user.id);
        
        // Reload filters
        const filters = await loadFilters(user.id);
        setSavedFilters(filters);
        
        // Apply the new filter
        setActiveFilterId(filterId);
        setActiveFilterConditions(filter.conditions);
      }
      
      setFilterSidebarOpen(false);
    } catch (error) {
      console.error('Error saving filter:', error);
      alert('Failed to save filter. Please try again.');
    }
  };
  
  const handleFilterEdit = (filterId: string) => {
    const filter = savedFilters.find(f => f.id === filterId);
    if (filter) {
      setEditingFilter({
        id: filter.id,
        name: filter.name,
        isPublic: filter.isPublic,
        conditions: filter.conditions,
      });
      setFilterSidebarOpen(true);
    }
  };
  
  const handleFilterDelete = (filterId: string) => {
    const filter = savedFilters.find(f => f.id === filterId);
    if (filter) {
      setFilterToDelete({ id: filter.id, name: filter.name });
      setDeleteConfirmOpen(true);
    }
  };
  
  const confirmDeleteFilter = async () => {
    if (!filterToDelete) return;
    
    try {
      await deleteFilter(filterToDelete.id);
      
      // Reload filters
      const filters = await loadFilters(user!.id);
      setSavedFilters(filters);
      
      // If deleted filter was active, reset to "All Accounts"
      if (activeFilterId === filterToDelete.id) {
        setActiveFilterId('all');
        setActiveFilterConditions([]);
      }
      
      setFilterToDelete(null);
    } catch (error) {
      console.error('Error deleting filter:', error);
      alert('Failed to delete filter. Please try again.');
    }
  };
  
  const handleFilterCopy = async (filterId: string) => {
    if (!user) return;
    
    const filter = savedFilters.find(f => f.id === filterId);
    if (!filter) return;
    
    try {
      const newFilterId = await saveFilter({
        name: `${filter.name} (Copy)`,
        isPublic: false, // Copies are always private
        conditions: filter.conditions,
        createdBy: user.id,
      }, user.id);
      
      // Reload filters
      const filters = await loadFilters(user.id);
      setSavedFilters(filters);
      
      // Optionally switch to the copied filter
      setActiveFilterId(newFilterId);
      setActiveFilterConditions(filter.conditions);
    } catch (error) {
      console.error('Error copying filter:', error);
      alert('Failed to copy filter. Please try again.');
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
      {
        id: 'fishbowlId',
        accessorKey: 'fishbowlId',
        header: 'Fishbowl ID',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'copperId',
        accessorKey: 'copperId',
        header: 'Copper ID',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'isActiveCustomer',
        accessorKey: 'isActiveCustomer',
        header: 'Active Customer',
        cell: ({ getValue }) => {
          const isActive = getValue() as boolean;
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {isActive ? 'Yes' : 'No'}
            </span>
          );
        },
      },
      {
        id: 'website',
        accessorKey: 'website',
        header: 'Website',
        cell: ({ getValue }) => {
          const website = getValue() as string;
          return website ? (
            <a href={website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm truncate max-w-[200px] block">
              {website}
            </a>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'shippingStreet',
        accessorKey: 'shippingStreet',
        header: 'Shipping Street',
        cell: ({ getValue }) => (
          <span className="text-gray-600 text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'shippingZip',
        accessorKey: 'shippingZip',
        header: 'Shipping Zip',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'billingStreet',
        accessorKey: 'billingStreet',
        header: 'Billing Street',
        cell: ({ getValue }) => (
          <span className="text-gray-600 text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'billingCity',
        accessorKey: 'billingCity',
        header: 'Billing City',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'billingState',
        accessorKey: 'billingState',
        header: 'Billing State',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'billingZip',
        accessorKey: 'billingZip',
        header: 'Billing Zip',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'shippingTerms',
        accessorKey: 'shippingTerms',
        header: 'Shipping Terms',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'carrierName',
        accessorKey: 'carrierName',
        header: 'Carrier',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'lastOrderDate',
        accessorKey: 'lastOrderDate',
        header: 'Last Order Date',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'firstOrderDate',
        accessorKey: 'firstOrderDate',
        header: 'First Order Date',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'primaryContactName',
        accessorKey: 'primaryContactName',
        header: 'Primary Contact',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'primaryContactEmail',
        accessorKey: 'primaryContactEmail',
        header: 'Contact Email',
        cell: ({ getValue }) => {
          const email = getValue() as string;
          return email ? (
            <a href={`mailto:${email}`} className="text-blue-600 hover:underline text-sm truncate max-w-[200px] block">
              {email}
            </a>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'primaryContactPhone',
        accessorKey: 'primaryContactPhone',
        header: 'Contact Phone',
        cell: ({ getValue }) => {
          const phone = getValue() as string;
          return phone ? (
            <a href={`tel:${phone}`} className="text-gray-600 hover:text-[#93D500] text-sm">
              {phone}
            </a>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'organizationLevel',
        accessorKey: 'organizationLevel',
        header: 'Organization Level',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'businessModel',
        accessorKey: 'businessModel',
        header: 'Business Model',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'copperUrl',
        accessorKey: 'copperUrl',
        header: 'Copper URL',
        cell: ({ getValue }) => {
          const url = getValue() as string;
          return url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
              View in Copper
            </a>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'contactType',
        accessorKey: 'contactType',
        header: 'Contact Type',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'inactiveDays',
        accessorKey: 'inactiveDays',
        header: 'Inactive Days',
        cell: ({ getValue }) => {
          const days = getValue() as number;
          return days !== undefined ? (
            <span className="text-gray-600">{days}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'interactionCount',
        accessorKey: 'interactionCount',
        header: 'Interactions',
        cell: ({ getValue }) => {
          const count = getValue() as number;
          return count !== undefined ? (
            <span className="text-gray-600">{count}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'lastContacted',
        accessorKey: 'lastContacted',
        header: 'Last Contacted',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'ownedBy',
        accessorKey: 'ownedBy',
        header: 'Owned By',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: 'Created Date',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'updatedAt',
        accessorKey: 'updatedAt',
        header: 'Updated Date',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'notes',
        accessorKey: 'notes',
        header: 'Notes',
        cell: ({ getValue }) => {
          const notes = getValue() as string;
          return notes ? (
            <span className="text-gray-600 text-sm truncate max-w-[300px] block" title={notes}>
              {notes}
            </span>
          ) : <span className="text-gray-400">-</span>;
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
      {/* Delete Filter Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setFilterToDelete(null);
        }}
        onConfirm={confirmDeleteFilter}
        title="Delete Filter"
        message={filterToDelete ? `Are you sure you want to delete "${filterToDelete.name}"? This action cannot be undone.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Saved Filters Panel */}
      <SavedFiltersPanel
        isCollapsed={filtersCollapsed}
        onToggle={() => setFiltersCollapsed(!filtersCollapsed)}
        onFilterSelect={handleFilterSelect}
        entityName="Accounts"
        onNewFilter={() => {
          setEditingFilter(null);
          setFilterSidebarOpen(true);
        }}
        onEditFilter={handleFilterEdit}
        onDeleteFilter={handleFilterDelete}
        onCopyFilter={handleFilterCopy}
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
            onClose={() => {
              setFilterSidebarOpen(false);
              setEditingFilter(null);
            }}
            onSave={handleFilterSave}
            editingFilter={editingFilter}
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
              <div className="relative">
                <button
                  onClick={() => setSortMenuOpen(!sortMenuOpen)}
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
                  title="Sort"
                >
                  <SortDesc className="w-4 h-4" />
                </button>
                {sortMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSortMenuOpen(false)} />
                    <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Sort By</p>
                      </div>
                      {[
                        { field: 'name', label: 'Account Name (A-Z)', direction: 'asc' as const },
                        { field: 'name', label: 'Account Name (Z-A)', direction: 'desc' as const },
                        { field: 'created_at', label: 'Date Added (Newest)', direction: 'desc' as const },
                        { field: 'created_at', label: 'Date Added (Oldest)', direction: 'asc' as const },
                        { field: 'last_order_date', label: 'Last Order (Recent)', direction: 'desc' as const },
                        { field: 'last_order_date', label: 'Last Order (Oldest)', direction: 'asc' as const },
                        { field: 'total_spent', label: 'Total Spent (High-Low)', direction: 'desc' as const },
                        { field: 'total_spent', label: 'Total Spent (Low-High)', direction: 'asc' as const },
                      ].map((option) => (
                        <button
                          key={`${option.field}-${option.direction}`}
                          onClick={() => {
                            setSortBy({ field: option.field, direction: option.direction });
                            setSortMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                            sortBy.field === option.field && sortBy.direction === option.direction
                              ? 'bg-[#93D500]/10 text-[#93D500] font-medium'
                              : 'text-gray-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
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
          userId={user.id}
        />
      )}
    </div>
  );
}
