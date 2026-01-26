'use client';

import { useState } from 'react';
import { Plus, ChevronRight, ChevronDown, Search, Star, MoreVertical, Trash2, Copy } from 'lucide-react';

interface SavedFilter {
  id: string;
  name: string;
  isPublic: boolean;
  count?: number;
  isFavorite?: boolean;
}

interface SavedFiltersPanelProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onFilterSelect: (filterId: string) => void;
  onNewFilter: () => void;
  onEditFilter: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  onCopyFilter: (filterId: string) => void;
  activeFilterId: string | null;
  publicFilters: SavedFilter[];
  privateFilters: SavedFilter[];
}

export function SavedFiltersPanel({
  isCollapsed,
  onToggle,
  onFilterSelect,
  onNewFilter,
  onEditFilter,
  onDeleteFilter,
  onCopyFilter,
  activeFilterId,
  publicFilters,
  privateFilters
}: SavedFiltersPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [publicExpanded, setPublicExpanded] = useState(true);
  const [privateExpanded, setPrivateExpanded] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const filterBySearch = (filters: SavedFilter[]) => {
    if (!searchTerm) return filters;
    return filters.filter(f => 
      f.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div
      className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 relative ${
        isCollapsed ? 'w-12' : 'w-60'
      }`}
    >
      {/* Collapse Button - Top right edge */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 flex items-center justify-center transition-all duration-200 z-10"
        title={isCollapsed ? 'Expand Filters' : 'Collapse Filters'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-600 rotate-180" />
        )}
      </button>

      {/* Header */}
      <div className="px-4 pt-4 pb-2.5 border-b border-gray-200">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <button
              onClick={onNewFilter}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
              title="New Filter"
            >
              <Plus className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-gray-900">Saved Filters</h2>
              <button
                onClick={onNewFilter}
                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                title="New Filter"
              >
                <Plus className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Filters"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
              />
            </div>
          </>
        )}
      </div>

      {/* Filter Lists */}
      {!isCollapsed && (
      <div className="flex-1 overflow-y-auto">
        {/* All Accounts - Default */}
        <div className="px-4 py-1.5">
          <button
            onClick={() => onFilterSelect('all')}
            className={`w-full px-2.5 py-1.5 text-left text-xs rounded-md transition-colors ${
              activeFilterId === 'all'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            All Accounts
          </button>
        </div>

        {/* Public Filters */}
        <div className="border-t border-gray-200">
          <button
            onClick={() => setPublicExpanded(!publicExpanded)}
            className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Public
            </span>
            {publicExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-400" />
            )}
          </button>

          {publicExpanded && (
            <div className="px-4 pb-1.5 space-y-0.5">
              {filterBySearch(publicFilters).map((filter) => (
                <div key={filter.id} className="relative group">
                  <button
                    onClick={() => onFilterSelect(filter.id)}
                    onDoubleClick={() => onEditFilter(filter.id)}
                    className={`w-full px-2.5 py-1 text-left text-xs rounded-md transition-colors flex items-center justify-between ${
                      activeFilterId === filter.id
                        ? 'bg-[#93D500]/10 text-[#93D500] font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate flex-1">{filter.name}</span>
                    <div className="flex items-center gap-1">
                      {filter.count !== undefined && (
                        <span className="text-[10px] text-gray-400">{filter.count}</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === filter.id ? null : filter.id);
                        }}
                        className="p-0.5 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  </button>
                  {activeMenu === filter.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                        <button
                          onClick={() => {
                            onEditFilter(filter.id);
                            setActiveMenu(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                        >
                          <ChevronRight className="w-3 h-3" />
                          Edit Filter
                        </button>
                        <button
                          onClick={() => {
                            onCopyFilter(filter.id);
                            setActiveMenu(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Copy className="w-3 h-3" />
                          Duplicate
                        </button>
                        <button
                          onClick={() => {
                            onDeleteFilter(filter.id);
                            setActiveMenu(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Private Filters */}
        <div className="border-t border-gray-200">
          <button
            onClick={() => setPrivateExpanded(!privateExpanded)}
            className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Private
            </span>
            {privateExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-400" />
            )}
          </button>

          {privateExpanded && (
            <div className="px-4 pb-1.5 space-y-0.5">
              {filterBySearch(privateFilters).map((filter) => (
                <div key={filter.id} className="relative group">
                  <button
                    onClick={() => onFilterSelect(filter.id)}
                    onDoubleClick={() => onEditFilter(filter.id)}
                    className={`w-full px-2.5 py-1 text-left text-xs rounded-md transition-colors flex items-center justify-between ${
                      activeFilterId === filter.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate flex-1">{filter.name}</span>
                    <div className="flex items-center gap-1">
                      {filter.isFavorite && <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />}
                      {filter.count !== undefined && (
                        <span className="text-[10px] text-gray-400">{filter.count}</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === filter.id ? null : filter.id);
                        }}
                        className="p-0.5 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  </button>
                  {activeMenu === filter.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                        <button
                          onClick={() => {
                            onEditFilter(filter.id);
                            setActiveMenu(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                        >
                          <ChevronRight className="w-3 h-3" />
                          Edit Filter
                        </button>
                        <button
                          onClick={() => {
                            onCopyFilter(filter.id);
                            setActiveMenu(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Copy className="w-3 h-3" />
                          Duplicate
                        </button>
                        <button
                          onClick={() => {
                            onDeleteFilter(filter.id);
                            setActiveMenu(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
