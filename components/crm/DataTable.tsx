'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnOrderState,
  VisibilityState,
} from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronUp,
  ChevronDown,
  Settings2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
  Eye,
  EyeOff,
  Columns3,
} from 'lucide-react';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  tableId: string;
  searchPlaceholder?: string;
  toolbarActions?: React.ReactNode;
  leftToolbarActions?: React.ReactNode; // Icons on left side of toolbar
  rightToolbarActions?: React.ReactNode; // Actions on right side (e.g., Add button)
}

// Sortable header cell component
function SortableHeaderCell({ id, children, isNonDraggable }: { id: string; children: React.ReactNode; isNonDraggable?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isNonDraggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 border-b border-gray-200 whitespace-nowrap ${
        isNonDraggable ? '' : 'cursor-move'
      }`}
      {...(isNonDraggable ? {} : attributes)}
      {...(isNonDraggable ? {} : listeners)}
    >
      <div className="flex items-center gap-1">
        {!isNonDraggable && <GripVertical className="w-3 h-3 text-gray-400" />}
        {children}
      </div>
    </th>
  );
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading = false,
  onRowClick,
  tableId,
  searchPlaceholder = 'Search...',
  toolbarActions,
  leftToolbarActions,
  rightToolbarActions,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const currentColumnIds = columns.map((col) => (col as any).id || (col as any).accessorKey);
    
    const savedPrefs = localStorage.getItem(`table-prefs-${tableId}`);
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.columnVisibility) setColumnVisibility(prefs.columnVisibility);
        
        if (prefs.columnOrder) {
          // Ensure 'select' column is always first if it exists
          const hasSelectColumn = currentColumnIds.includes('select');
          if (hasSelectColumn) {
            const savedOrderWithoutSelect = prefs.columnOrder.filter((id: string) => id !== 'select');
            const newOrder = ['select', ...savedOrderWithoutSelect.filter((id: string) => currentColumnIds.includes(id))];
            setColumnOrder(newOrder);
          } else {
            setColumnOrder(prefs.columnOrder.filter((id: string) => currentColumnIds.includes(id)));
          }
        } else {
          setColumnOrder(currentColumnIds);
        }
      } catch (e) {
        console.error('Error loading table preferences:', e);
        setColumnOrder(currentColumnIds);
      }
    } else {
      // Initialize column order from columns
      setColumnOrder(currentColumnIds);
    }
  }, [tableId, columns]);

  // Save preferences when they change
  useEffect(() => {
    if (columnOrder.length > 0) {
      localStorage.setItem(
        `table-prefs-${tableId}`,
        JSON.stringify({ columnVisibility, columnOrder })
      );
    }
  }, [columnVisibility, columnOrder, tableId]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
      columnOrder,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // No pagination model - we use infinite scroll
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setColumnOrder((items) => {
          const oldIndex = items.indexOf(active.id as string);
          const newIndex = items.indexOf(over.id as string);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    },
    []
  );

  const visibleColumns = table.getAllLeafColumns().filter((col) => col.getIsVisible());

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#93D500]"></div>
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white overflow-hidden">
      {/* Toolbar - Integrated with Table */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-4">
        {/* Left: Tool Icons */}
        <div className="flex items-center gap-2">
          {leftToolbarActions}
        </div>

        {/* Center: Selection or Search */}
        {toolbarActions ? (
          <div className="flex-1 flex justify-center">
            {toolbarActions}
          </div>
        ) : searchExpanded ? (
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-[#93D500] focus:border-transparent outline-none text-sm"
              autoFocus
              onBlur={() => {
                if (!globalFilter) setSearchExpanded(false);
              }}
            />
            {globalFilter && (
              <button
                onClick={() => {
                  setGlobalFilter('');
                  setSearchExpanded(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right: Search Icon + Record Count + Column Settings + Add Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSearchExpanded(true)}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500">
            {table.getFilteredRowModel().rows.length} records
          </span>
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title="Column settings"
          >
            <Columns3 className="w-4 h-4 text-gray-600" />
          </button>
          {rightToolbarActions}
        </div>
      </div>

      {/* Column Settings Panel */}
      {showColumnSettings && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Column Visibility</h3>
            <button
              onClick={() => {
                const allVisible: VisibilityState = {};
                table.getAllLeafColumns().forEach((col) => {
                  allVisible[col.id] = true;
                });
                setColumnVisibility(allVisible);
              }}
              className="text-xs text-[#93D500] hover:underline"
            >
              Show All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {table.getAllLeafColumns().map((column) => (
              <button
                key={column.id}
                onClick={() => column.toggleVisibility()}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                  column.getIsVisible()
                    ? 'bg-[#93D500]/10 text-[#93D500] border border-[#93D500]/30'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                {column.getIsVisible() ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                {typeof column.columnDef.header === 'string'
                  ? column.columnDef.header
                  : column.id}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Drag column headers to reorder. Your preferences are saved automatically.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full">
            <thead>
              <tr>
                <SortableContext
                  items={columnOrder}
                  strategy={horizontalListSortingStrategy}
                >
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => {
                      const isSelect = header.id === 'select';
                      
                      return (
                        <SortableHeaderCell 
                          key={header.id} 
                          id={header.id}
                          isNonDraggable={isSelect}
                        >
                          <button
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex items-center gap-1 hover:text-gray-900"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getIsSorted() === 'asc' && (
                              <ChevronUp className="w-4 h-4" />
                            )}
                            {header.column.getIsSorted() === 'desc' && (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </SortableHeaderCell>
                      );
                    })
                  )}
                </SortableContext>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={`hover:bg-gray-50 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td 
                      key={cell.id} 
                      className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </DndContext>
      </div>

    </div>
  );
}
