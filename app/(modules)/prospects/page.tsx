'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useLeads, useLeadCounts } from '@/lib/crm/hooks-crm';
import { DataTable } from '@/components/crm/DataTable';
import { SavedFiltersPanel } from '@/components/crm/SavedFiltersPanel';
import { FilterSidebar, type FilterCondition } from '@/components/crm/FilterSidebar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { saveFilter, loadFilters, deleteFilter, updateFilter, type SavedFilter } from '@/lib/crm/supabaseFilterService';
import type { Lead } from '@/lib/crm/types-crm';
import { 
  Plus,
  Filter,
  SortDesc,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Thermometer,
  Calendar,
} from 'lucide-react';

export default function ProspectsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
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
  } = useLeads({ 
    pageSize: 50,
    filterConditions: activeFilterConditions 
  });
  const { data: counts } = useLeadCounts(activeFilterConditions);
  
  const prospects = useMemo(() => {
    const flatProspects = (data?.pages.flatMap(page => page.data) || []) as Lead[];
    return flatProspects.sort((a: Lead, b: Lead) => {
      const aValue = a[sortBy.field as keyof Lead];
      const bValue = b[sortBy.field as keyof Lead];
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
  
  const totalProspects = counts?.total || 0;
  const newCount = counts?.new || 0;
  const qualifiedCount = counts?.qualified || 0;
  const hotCount = counts?.hot || 0;
  const convertedCount = counts?.converted || 0;
  
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

  const columns = useMemo<ColumnDef<Lead, any>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900">{row.original.name}</span>
          </div>
        ),
      },
      {
        id: 'company',
        accessorKey: 'company',
        header: 'Company',
        cell: ({ getValue }) => (
          <div className="flex items-center gap-1 text-gray-700">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            {getValue() || '-'}
          </div>
        ),
      },
      {
        id: 'title',
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const colors: Record<string, string> = {
            new: 'bg-blue-100 text-blue-700',
            contacted: 'bg-yellow-100 text-yellow-700',
            qualified: 'bg-green-100 text-green-700',
            unqualified: 'bg-gray-100 text-gray-600',
            converted: 'bg-purple-100 text-purple-700',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
              {status}
            </span>
          );
        },
      },
      {
        id: 'lead_temperature',
        accessorKey: 'lead_temperature',
        header: 'Temperature',
        cell: ({ getValue }) => {
          const temp = getValue() as string;
          if (!temp) return <span className="text-gray-400">-</span>;
          const colors: Record<string, string> = {
            Hot: 'bg-red-100 text-red-700',
            Warm: 'bg-orange-100 text-orange-700',
            Cold: 'bg-blue-100 text-blue-700',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${colors[temp] || 'bg-gray-100'}`}>
              <Thermometer className="w-3 h-3" />
              {temp}
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
            copper_lead: 'bg-orange-100 text-orange-700',
            manual: 'bg-gray-100 text-gray-600',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[source] || 'bg-gray-100'}`}>
              {source === 'copper_lead' ? 'Copper' : source}
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
        header: 'Type',
        cell: ({ getValue }) => {
          const type = getValue() as string | undefined;
          return type ? (
            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{type}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'follow_up_date',
        accessorKey: 'follow_up_date',
        header: 'Follow-up',
        cell: ({ getValue }) => {
          const date = getValue() as Date | undefined;
          if (!date) return <span className="text-gray-400">-</span>;
          const d = new Date(date);
          const isPast = d < new Date();
          return (
            <div className={`flex items-center gap-1 ${isPast ? 'text-red-600' : 'text-gray-600'}`}>
              <Calendar className="w-3.5 h-3.5" />
              {d.toLocaleDateString()}
            </div>
          );
        },
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
        id: 'account',
        accessorKey: 'account',
        header: 'Account',
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
        id: 'value',
        accessorKey: 'value',
        header: 'Value',
        cell: ({ getValue }) => {
          const value = getValue() as number | null;
          return value ? (
            <div className="flex items-center gap-1 text-gray-700 font-medium">
              <span>$</span>
              {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'converted_at',
        accessorKey: 'converted_at',
        header: 'Converted At',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'converted_value',
        accessorKey: 'converted_value',
        header: 'Converted Value',
        cell: ({ getValue }) => {
          const value = getValue() as number | null;
          return value ? (
            <div className="flex items-center gap-1 text-green-700 font-medium">
              <span>$</span>
              {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'owned_by',
        accessorKey: 'owned_by',
        header: 'Owned By',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'last_status_at',
        accessorKey: 'last_status_at',
        header: 'Last Status',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'last_contacted',
        accessorKey: 'last_contacted',
        header: 'Last Contacted',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? (
            <span className="text-gray-600 text-sm">{new Date(date).toLocaleDateString()}</span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'inactive_days',
        accessorKey: 'inactive_days',
        header: 'Inactive Days',
        cell: ({ getValue }) => {
          const days = getValue() as number;
          return days !== undefined ? (
            <span className="text-gray-600">{days}</span>
          ) : <span className="text-gray-400">-</span>;
        },
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
        id: 'business_model',
        accessorKey: 'business_model',
        header: 'Business Model',
        cell: ({ getValue }) => (
          <span className="text-gray-600">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'details',
        accessorKey: 'details',
        header: 'Details',
        cell: ({ getValue }) => {
          const details = getValue() as string;
          return details ? (
            <span className="text-gray-600 text-sm truncate max-w-[300px] block" title={details}>
              {details}
            </span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'prospect_notes',
        accessorKey: 'prospect_notes',
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
      {
        id: 'copper_id',
        accessorKey: 'copper_id',
        header: 'Copper ID',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'copper_url',
        accessorKey: 'copper_url',
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
        id: 'work_email',
        accessorKey: 'work_email',
        header: 'Work Email',
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
    []
  );

  const handleRowClick = (prospect: Lead) => {
    router.push(`/prospects/${prospect.id}`);
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
        entityName="Prospects"
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
                {activeFilterId === 'all' ? 'All Prospects' : publicFilters.concat(privateFilters).find(f => f.id === activeFilterId)?.name || 'Prospects'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {totalProspects.toLocaleString()} total prospects
                <span className="text-gray-400 mx-2">•</span>
                New: {newCount} | Qualified: {qualifiedCount} | Hot: {hotCount}
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
              data={prospects}
              columns={columns}
              loading={isLoading}
              onRowClick={handleRowClick}
              tableId="prospects"
              searchPlaceholder="Search prospects by name, company, email, phone..."
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
                  onClick={() => router.push('/prospects/new')}
                  className="px-4 py-2 bg-[#93D500] text-white rounded-md hover:bg-[#84c000] flex items-center gap-2 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Prospect
                </button>
              }
            />
        
            {hasNextPage && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#93D500]"></div>
                    <span className="text-sm">Loading more prospects...</span>
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
