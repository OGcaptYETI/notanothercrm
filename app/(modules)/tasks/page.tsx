'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTasks, useTaskCounts } from '@/lib/crm/hooks-crm';
import { DataTable } from '@/components/crm/DataTable';
import { SavedFiltersPanel } from '@/components/crm/SavedFiltersPanel';
import { FilterSidebar, type FilterCondition } from '@/components/crm/FilterSidebar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { saveFilter, loadFilters, deleteFilter, updateFilter, type SavedFilter } from '@/lib/crm/supabaseFilterService';
import { TASKS_FILTER_FIELDS } from '@/lib/crm/filterFields-tasks';
import type { Task } from '@/lib/crm/types-crm';
import Image from 'next/image';
import { 
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  User,
  Building2,
  Filter,
  ArrowUpDown,
  CheckSquare,
  MoreVertical,
} from 'lucide-react';

export default function TasksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // Filter & Sidebar State
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  const [activeFilterId, setActiveFilterId] = useState<string | null>('all');
  const [activeFilterConditions, setActiveFilterConditions] = useState<FilterCondition[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [filterToDelete, setFilterToDelete] = useState<SavedFilter | null>(null);
  
  // Sorting State
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<{ field: string; direction: 'asc' | 'desc' }>({ 
    field: 'due_date', 
    direction: 'desc' 
  });

  // Data Fetching
  const { 
    data, 
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTasks({ 
    pageSize: 50,
    filterConditions: activeFilterConditions,
    sortBy: sortBy.field,
    sortDirection: sortBy.direction,
  });
  const { data: counts } = useTaskCounts(activeFilterConditions);
  
  // Sorted and flattened tasks
  const tasks = useMemo(() => {
    const flatTasks = (data?.pages.flatMap(page => page.data) || []) as Task[];
    return flatTasks.sort((a: Task, b: Task) => {
      const aValue = (a as any)[sortBy.field];
      const bValue = (b as any)[sortBy.field];
      let comparison = 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
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
  
  const totalTasks = counts?.total || 0;
  const completedTasks = counts?.completed || 0;
  const pendingTasks = counts?.pending || 0;
  
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

  useEffect(() => {
    const handleSidebarToggle = (e: CustomEvent) => {
      setFiltersCollapsed(e.detail.collapsed);
    };
    window.addEventListener('sidebar-toggle' as any, handleSidebarToggle);
    return () => {
      window.removeEventListener('sidebar-toggle' as any, handleSidebarToggle);
    };
  }, []);

  const publicFilters = savedFilters.filter(f => f.is_public);
  const privateFilters = savedFilters.filter(f => !f.is_public);

  const handleFilterSave = async (name: string, conditions: FilterCondition[], isPublic: boolean) => {
    if (!user) return;
    try {
      if (editingFilter) {
        await updateFilter(editingFilter.id, { name, filter_conditions: conditions, is_public: isPublic });
      } else {
        await saveFilter({
          name,
          filter_type: 'tasks',
          filter_conditions: conditions,
          is_public: isPublic,
          user_id: user.id,
        });
      }
      const filters = await loadFilters(user.id);
      setSavedFilters(filters);
      setFilterSidebarOpen(false);
      setEditingFilter(null);
    } catch (error) {
      console.error('Error saving filter:', error);
    }
  };

  const handleFilterEdit = (filterId: string) => {
    const filter = savedFilters.find(f => f.id === filterId);
    if (filter) {
      setEditingFilter(filter);
      setFilterSidebarOpen(true);
    }
  };

  const handleFilterDelete = (filterId: string) => {
    const filter = savedFilters.find(f => f.id === filterId);
    if (filter) {
      setFilterToDelete(filter);
      setDeleteConfirmOpen(true);
    }
  };

  const confirmDeleteFilter = async () => {
    if (!filterToDelete || !user) return;
    try {
      await deleteFilter(filterToDelete.id);
      const filters = await loadFilters(user.id);
      setSavedFilters(filters);
      if (activeFilterId === filterToDelete.id) {
        setActiveFilterId('all');
        setActiveFilterConditions([]);
      }
    } catch (error) {
      console.error('Error deleting filter:', error);
    } finally {
      setDeleteConfirmOpen(false);
      setFilterToDelete(null);
    }
  };

  const handleFilterCopy = async (filterId: string) => {
    const filter = savedFilters.find(f => f.id === filterId);
    if (!filter || !user) return;
    try {
      await saveFilter({
        name: `${filter.name} (Copy)`,
        filter_type: 'tasks',
        filter_conditions: filter.filter_conditions,
        is_public: false,
        user_id: user.id,
      });
      const filters = await loadFilters(user.id);
      setSavedFilters(filters);
    } catch (error) {
      console.error('Error copying filter:', error);
    }
  };

  const handleFilterSelect = (filterId: string) => {
    if (filterId === 'all') {
      setActiveFilterId('all');
      setActiveFilterConditions([]);
    } else {
      const filter = savedFilters.find(f => f.id === filterId);
      if (filter) {
        setActiveFilterId(filterId);
        setActiveFilterConditions(filter.filter_conditions);
      }
    }
  };

  // Define table columns
  const columns = useMemo<ColumnDef<Task, any>[]>(
    () => [
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          if (status === 'completed' || getValue() === 'Completed') {
            return (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium">Complete</span>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1 text-orange-600">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Pending</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Task',
        cell: ({ row }) => (
          <div className="font-medium text-gray-900 max-w-md truncate">
            {row.original.name}
          </div>
        ),
      },
      {
        id: 'priority',
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ getValue }) => {
          const priority = getValue() as string;
          const colors: Record<string, string> = {
            high: 'bg-red-100 text-red-700',
            medium: 'bg-yellow-100 text-yellow-700',
            low: 'bg-blue-100 text-blue-700',
            urgent: 'bg-purple-100 text-purple-700',
          };
          return priority ? (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority.toLowerCase()] || 'bg-gray-100'}`}>
              {priority}
            </span>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'related_to_type',
        accessorKey: 'related_to_type',
        header: 'Related To',
        cell: ({ row }) => {
          const type = row.original.related_to_type;
          const icons: Record<string, any> = {
            account: Building2,
            person: User,
            opportunity: AlertCircle,
          };
          const Icon = type ? icons[type] : null;
          return type ? (
            <div className="flex items-center gap-1 text-gray-600">
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span className="capitalize">{type}</span>
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'owner',
        accessorKey: 'owner',
        header: 'Owner',
        cell: ({ getValue }) => (
          <div className="flex items-center gap-1 text-gray-600">
            <User className="w-3.5 h-3.5" />
            {getValue() || '-'}
          </div>
        ),
      },
      {
        id: 'due_date',
        accessorKey: 'due_date',
        header: 'Due Date',
        cell: ({ getValue }) => {
          const date = getValue() as string | null;
          if (!date) return <span className="text-gray-400">-</span>;
          const d = new Date(date);
          const isPast = d < new Date();
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div className={`flex items-center gap-1 ${isPast ? 'text-red-600 font-medium' : isToday ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
              <Calendar className="w-3.5 h-3.5" />
              {d.toLocaleDateString()}
            </div>
          );
        },
      },
      {
        id: 'completed_at',
        accessorKey: 'completed_at',
        header: 'Completed',
        cell: ({ getValue }) => {
          const date = getValue() as string | null;
          if (!date) return <span className="text-gray-400">-</span>;
          return (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {new Date(date).toLocaleDateString()}
            </div>
          );
        },
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
        id: 'account_number',
        accessorKey: 'account_number',
        header: 'Account #',
        cell: ({ getValue }) => (
          <span className="text-gray-600 font-mono text-sm">{getValue() || '-'}</span>
        ),
      },
      {
        id: 'reminder_date',
        accessorKey: 'reminder_date',
        header: 'Reminder',
        cell: ({ getValue }) => {
          const date = getValue() as string | null;
          if (!date) return <span className="text-gray-400">-</span>;
          return (
            <div className="flex items-center gap-1 text-gray-600">
              <AlertCircle className="w-3.5 h-3.5" />
              {new Date(date).toLocaleDateString()}
            </div>
          );
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
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Created',
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
        header: 'Updated',
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

  const handleRowClick = (task: Task) => {
    console.log('Task clicked:', task.id);
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

  // Auth check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
          <Image 
            src="/images/kanva_logo_rotate.gif" 
            alt="Loading..." 
            width={64}
            height={64}
            className="mx-auto mb-4"
            priority
            unoptimized
          />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
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
        entityName="Tasks"
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">All Tasks</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {totalTasks.toLocaleString()} total tasks • Completed: {completedTasks.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => router.push('/tasks/new')}
                className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-500">Total Tasks</div>
                <div className="text-2xl font-bold text-gray-900">{totalTasks.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-500">Completed</div>
                <div className="text-2xl font-bold text-green-600">
                  {completedTasks.toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-500">Pending</div>
                <div className="text-2xl font-bold text-orange-600">
                  {pendingTasks.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Data Table */}
            <DataTable
              data={tasks}
              columns={columns}
              loading={isLoading}
              onRowClick={handleRowClick}
              tableId="tasks"
              searchPlaceholder="Search tasks..."
              leftToolbarActions={
                <>
                  <button
                    onClick={() => setFilterSidebarOpen(true)}
                    className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                    title="Filter"
                  >
                    <Filter className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setSortMenuOpen(!sortMenuOpen)}
                      className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                      title="Sort"
                    >
                      <ArrowUpDown className="w-4 h-4 text-gray-600" />
                    </button>
                    {sortMenuOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
                        <div className="p-2 space-y-1">
                          {[
                            { field: 'due_date', label: 'Due Date' },
                            { field: 'name', label: 'Task Name' },
                            { field: 'priority', label: 'Priority' },
                            { field: 'status', label: 'Status' },
                            { field: 'created_at', label: 'Created Date' },
                          ].map(({ field, label }) => (
                            <button
                              key={field}
                              onClick={() => {
                                setSortBy(prev => ({
                                  field,
                                  direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
                                }));
                                setSortMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded flex items-center justify-between"
                            >
                              <span>{label}</span>
                              {sortBy.field === field && (
                                <span className="text-xs text-gray-500">
                                  {sortBy.direction === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              }
            />
            
            {/* Infinite Scroll Trigger */}
            {hasNextPage && (
              <div ref={loadMoreRef} className="py-4 text-center">
                {isFetchingNextPage ? (
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#93D500]"></div>
                    <span>Loading more...</span>
                  </div>
                ) : (
                  <span className="text-gray-400">Scroll for more</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Sidebar */}
      <FilterSidebar
        isOpen={filterSidebarOpen}
        onClose={() => {
          setFilterSidebarOpen(false);
          setEditingFilter(null);
        }}
        onApply={(conditions) => {
          setActiveFilterConditions(conditions);
          setActiveFilterId(null);
        }}
        onSave={handleFilterSave}
        filterFields={TASKS_FILTER_FIELDS}
        initialConditions={editingFilter?.filter_conditions || activeFilterConditions}
        editingFilter={editingFilter}
      />
    </div>
  );
}
