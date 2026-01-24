'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import React from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
} from 'lucide-react';

interface ShipmentsDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  searchPlaceholder?: string;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  totalItems?: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  externalPagination?: boolean;
  renderExpandedRow?: (row: T) => React.ReactNode;
  expandedRows?: Set<any>;
  getRowId?: (row: T) => any;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export function ShipmentsDataTable<T>({
  data,
  columns,
  loading = false,
  onRowClick,
  pageSize = 100,
  searchPlaceholder = 'Search...',
  globalFilter = '',
  onGlobalFilterChange,
  totalItems,
  currentPage: externalCurrentPage,
  totalPages: externalTotalPages,
  onPageChange,
  externalPagination = false,
  renderExpandedRow,
  expandedRows,
  getRowId,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}: ShipmentsDataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalFilter, setInternalFilter] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const filterValue = onGlobalFilterChange ? globalFilter : internalFilter;
  const setFilterValue = onGlobalFilterChange || setInternalFilter;

  // Infinite scroll detection
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !onLoadMore || !hasMore || loadingMore) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      
      // Load more when user scrolls to 80% of content
      if (scrollPercentage > 0.8 && hasMore && !loadingMore) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, hasMore, loadingMore]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: filterValue,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilterValue,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: externalPagination ? undefined : getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
    manualPagination: externalPagination,
    pageCount: externalPagination ? externalTotalPages : undefined,
  });

  const currentPageNum = externalPagination ? (externalCurrentPage || 1) : table.getState().pagination.pageIndex + 1;
  const totalPagesNum = externalPagination ? (externalTotalPages || 1) : table.getPageCount();

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-500">Loading shipments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {filterValue && (
            <button
              onClick={() => setFilterValue('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {totalItems !== undefined
            ? `${data.length} records • ${totalItems.toLocaleString()} total`
            : `${table.getFilteredRowModel().rows.length.toLocaleString()} records`}
        </div>
      </div>

      {/* Table */}
      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto"
        style={{ maxHeight: 'calc(100vh - 500px)', overflowY: 'auto' }}
      >
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-1 ${
                          header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="ml-1">
                            {{
                              asc: <ChevronUp className="w-3 h-3" />,
                              desc: <ChevronDown className="w-3 h-3" />,
                            }[header.column.getIsSorted() as string] ?? (
                              <div className="w-3 h-3 opacity-30">
                                <ChevronUp className="w-3 h-3 -mb-1.5" />
                                <ChevronDown className="w-3 h-3" />
                              </div>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
                  No shipments found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const rowId = getRowId ? getRowId(row.original) : row.id;
                const isExpanded = expandedRows?.has(rowId);
                
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => onRowClick?.(row.original)}
                      className={`${
                        onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                      } transition-colors`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-4 text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && renderExpandedRow && (
                      <tr>
                        <td colSpan={columns.length} className="p-0 bg-gray-50">
                          {renderExpandedRow(row.original)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Loading More Indicator */}
      {loadingMore && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            Loading more orders...
          </div>
        </div>
      )}
      
      {/* End of results indicator */}
      {!hasMore && !loading && data.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
          All {totalItems || data.length} orders loaded
        </div>
      )}
    </div>
  );
}
