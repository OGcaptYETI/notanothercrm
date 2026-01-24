'use client';

import { useState } from 'react';
import { Search, Filter, SortDesc, Zap, Columns3, Plus, X } from 'lucide-react';

interface EnhancedToolbarProps {
  onSearchToggle: () => void;
  onFilterOpen: () => void;
  onSortOpen: () => void;
  onAutomationOpen: () => void;
  onColumnsOpen: () => void;
  onAddAccount: () => void;
  showSearch: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filterCount?: number;
}

export function EnhancedToolbar({
  onSearchToggle,
  onFilterOpen,
  onSortOpen,
  onAutomationOpen,
  onColumnsOpen,
  onAddAccount,
  showSearch,
  searchValue,
  onSearchChange,
  filterCount = 0
}: EnhancedToolbarProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        {/* Search Bar - Expandable */}
        {showSearch ? (
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by name, email, domain or phone number"
                autoFocus
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
              {searchValue && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <button
              onClick={onSearchToggle}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            {/* Left: Tool Icons */}
            <div className="flex items-center gap-2">
              <button
                onClick={onSearchToggle}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                onClick={onFilterOpen}
                className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Filter"
              >
                <Filter className="w-5 h-5" />
                {filterCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#93D500] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {filterCount}
                  </span>
                )}
              </button>

              <button
                onClick={onSortOpen}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sort"
              >
                <SortDesc className="w-5 h-5" />
              </button>

              <button
                onClick={onAutomationOpen}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Automation"
              >
                <Zap className="w-5 h-5" />
              </button>

              <button
                onClick={onColumnsOpen}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Columns"
              >
                <Columns3 className="w-5 h-5" />
              </button>
            </div>

            {/* Right: Add Account */}
            <button
              onClick={onAddAccount}
              className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
