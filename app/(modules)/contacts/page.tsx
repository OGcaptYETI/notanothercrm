'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/lib/contexts/AuthContext';
import { usePeople, usePeopleCounts } from '@/lib/crm/hooks-crm';
import { DataTable } from '@/components/crm/DataTable';
import { SavedFiltersPanel } from '@/components/crm/SavedFiltersPanel';
import { FilterSidebar, type FilterCondition } from '@/components/crm/FilterSidebar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { saveFilter, loadFilters, deleteFilter, updateFilter, type SavedFilter } from '@/lib/crm/supabaseFilterService';
import type { Person } from '@/lib/crm/types-crm';
import { 
  Plus,
  Filter,
  SortDesc,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Briefcase,
} from 'lucide-react';

export default function ContactsPage() {
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
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = usePeople({ 
    pageSize: 50,
    filterConditions: activeFilterConditions 
  });
  const { data: counts } = usePeopleCounts(activeFilterConditions);
  
  const contacts = useMemo(() => {
    const flatContacts = (data?.pages.flatMap(page => page.data) || []) as Person[];
    return flatContacts.sort((a: Person, b: Person) => {
      const aValue = a[sortBy.field as keyof Person];
      const bValue = b[sortBy.field as keyof Person];
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      return sortBy.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortBy]);
  
  const totalContacts = counts?.total || 0;
  const withAccounts = counts?.with_accounts || 0;
  
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
  
  const publicFilters = savedFilters.filter(f => f.isPublic);
  const privateFilters = savedFilters.filter(f => !f.isPublic);
  
  const handleFilterSave = async (filter: { name: string; isPublic: boolean; conditions: FilterCondition[] }) => {
    if (!user) return;
    try {
      if (editingFilter) {
        await updateFilter(editingFilter.id, {
          name: filter.name,
          isPublic: filter.isPublic,
          conditions: filter.conditions,
        });
        const filters = await loadFilters(user.id);
        setSavedFilters(filters);
        if (activeFilterId === editingFilter.id) {
          setActiveFilterConditions(filter.conditions);
        }
        setEditingFilter(null);
      } else {
        const filterId = await saveFilter({
          name: filter.name,
          isPublic: filter.isPublic,
          conditions: filter.conditions,
          createdBy: user.id,
        }, user.id);
        const filters = await loadFilters(user.id);
        setSavedFilters(filters);
        setActiveFilterId(filterId);
        setActiveFilterConditions(filter.conditions);
      }
      setFilterSidebarOpen(false);
    } catch (error) {
      console.error('Error saving filter:', error);
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
      const filters = await loadFilters(user!.id);
      setSavedFilters(filters);
      if (activeFilterId === filterToDelete.id) {
        setActiveFilterId('all');
        setActiveFilterConditions([]);
      }
      setFilterToDelete(null);
    } catch (error) {
      console.error('Error deleting filter:', error);
    }
  };
  
  const handleFilterCopy = async (filterId: string) => {
    if (!user) return;
    const filter = savedFilters.find(f => f.id === filterId);
    if (!filter) return;
    try {
      const newFilterId = await saveFilter({
        name: `${filter.name} (Copy)`,
        isPublic: false,
        conditions: filter.conditions,
        createdBy: user.id,
      }, user.id);
      const filters = await loadFilters(user.id);
      setSavedFilters(filters);
      setActiveFilterId(newFilterId);
      setActiveFilterConditions(filter.conditions);
    } catch (error) {
      console.error('Error copying filter:', error);
    }
  };
  
  const handleFilterSelect = (filterId: string) => {
    setActiveFilterId(filterId);
    if (filterId === 'all') {
      setActiveFilterConditions([]);
      return;
    }
    const filter = savedFilters.find(f => f.id === filterId);
    if (filter) {
      setActiveFilterConditions(filter.conditions);
    }
  };

  const columns = useMemo<ColumnDef<Person, any>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/contacts/${row.original.id}`);
              }}
              className="font-medium text-primary-600 hover:text-primary-700 hover:underline text-left truncate"
            >
              {row.original.name}
            </button>
          </div>
        ),
      },
      {
        id: 'title',
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => (
          <div className="flex items-center gap-1 text-gray-600">
            <Briefcase className="w-3.5 h-3.5 text-gray-400" />
            {getValue() || '-'}
          </div>
        ),
      },
      {
        id: 'company_name',
        accessorKey: 'company_name',
        header: 'Account',
        cell: ({ row }) => {
          const account = row.original.company_name;
          const accountId = row.original.account_id;
          return account ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (accountId) router.push(`/accounts/${accountId}`);
              }}
              className="flex items-center gap-1 text-gray-700 hover:text-[#93D500]"
            >
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              {account}
            </button>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'source',
        accessorKey: 'source',
        header: 'Source',
        cell: ({ getValue }) => {
          const source = getValue() as string;
          const colors: Record<string, string> = {
            copper_person: 'bg-orange-100 text-orange-700',
            manual: 'bg-gray-100 text-gray-600',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[source] || 'bg-gray-100'}`}>
              {source === 'copper_person' ? 'Copper' : source}
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
        accessorFn: (row) => `${row.city || ''} ${row.state || ''}`.trim(),
        header: 'Location',
        cell: ({ row }) => {
          const city = row.original.city;
          const state = row.original.state;
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
        id: 'account_type',
        accessorKey: 'account_type',
        header: 'Account Type',
        cell: ({ getValue }) => {
          const types = getValue() as string[] | null;
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
        id: 'customer_priority',
        accessorKey: 'customer_priority',
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
        id: 'organization_level',
        accessorKey: 'organization_level',
        header: 'Org Level',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'account_number',
        accessorKey: 'account_number',
        header: 'Account #',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'first_name',
        accessorKey: 'first_name',
        header: 'First Name',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'last_name',
        accessorKey: 'last_name',
        header: 'Last Name',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'street',
        accessorKey: 'street',
        header: 'Street',
        cell: ({ getValue }) => (
          <span className="text-gray-600 text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'postal_code',
        accessorKey: 'postal_code',
        header: 'Postal Code',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'country',
        accessorKey: 'country',
        header: 'Country',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'copper_id',
        accessorKey: 'copper_id',
        header: 'Copper ID',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'interaction_count',
        accessorKey: 'interaction_count',
        header: 'Interactions',
        cell: ({ getValue }) => {
          const count = getValue() as number;
          return count !== undefined ? (
            <span className="text-gray-600">{count}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'date_created',
        accessorKey: 'date_created',
        header: 'Date Created',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'date_modified',
        accessorKey: 'date_modified',
        header: 'Date Modified',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Created At',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'updated_at',
        accessorKey: 'updated_at',
        header: 'Updated At',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
    ],
    [router]
  );

  const handleRowClick = (contact: Person) => {
    router.push(`/contacts/${contact.id}`);
  };

  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setFilterToDelete(null);
        }}
        onConfirm={confirmDeleteFilter}
        title="Delete Filter"
        message={filterToDelete ? `Are you sure you want to delete "${filterToDelete.name}"?` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <SavedFiltersPanel
        isCollapsed={filtersCollapsed}
        onToggle={() => setFiltersCollapsed(!filtersCollapsed)}
        onFilterSelect={handleFilterSelect}
        entityName="Contacts"
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

      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {activeFilterId === 'all' ? 'All Contacts' : publicFilters.concat(privateFilters).find(f => f.id === activeFilterId)?.name || 'Contacts'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {totalContacts.toLocaleString()} total contacts
                <span className="text-gray-400 mx-2">•</span>
                With Accounts: <span className="font-medium text-[#93D500]">{withAccounts.toLocaleString()}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
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
              data={contacts}
              columns={columns}
              loading={isLoading}
              onRowClick={handleRowClick}
              tableId="contacts"
              searchPlaceholder="Search contacts by name, email, phone, account..."
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
                            { field: 'name', label: 'Name (A-Z)', direction: 'asc' as const },
                            { field: 'name', label: 'Name (Z-A)', direction: 'desc' as const },
                            { field: 'created_at', label: 'Date Added (Newest)', direction: 'desc' as const },
                            { field: 'created_at', label: 'Date Added (Oldest)', direction: 'asc' as const },
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
                </>
              }
              rightToolbarActions={
                <button
                  onClick={() => router.push('/contacts/new')}
                  className="px-4 py-2 bg-[#93D500] text-white rounded-md hover:bg-[#84c000] flex items-center gap-2 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Contact
                </button>
              }
            />
        
            {hasNextPage && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#93D500]"></div>
                    <span className="text-sm">Loading more contacts...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
