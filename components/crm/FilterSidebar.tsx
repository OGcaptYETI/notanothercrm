'use client';

import React, { useState } from 'react';
import { X, Save, Plus, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { ACCOUNT_FILTER_FIELDS, getFieldsByCategory, searchFilterFields, type FilterField } from '@/lib/crm/filterFields';

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_equals' | 'is_empty' | 'is_not_empty';
  value: any;
}

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filter: { name: string; isPublic: boolean; conditions: FilterCondition[] }) => void;
  editingFilter?: { id: string; name: string; isPublic: boolean; conditions: FilterCondition[] } | null;
}

export function FilterSidebar({ isOpen, onClose, onSave, editingFilter }: FilterSidebarProps) {
  const [filterName, setFilterName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['details']));
  const [fieldSearchTerm, setFieldSearchTerm] = useState('');

  // Load editing filter when it changes
  React.useEffect(() => {
    if (editingFilter) {
      setFilterName(editingFilter.name);
      setIsPublic(editingFilter.isPublic);
      setConditions(editingFilter.conditions || []);
    } else {
      setFilterName('');
      setIsPublic(false);
      setConditions([]);
    }
  }, [editingFilter]);

  // Get fields by category
  const fieldsByCategory = {
    interactions: getFieldsByCategory('interactions'),
    details: getFieldsByCategory('details'),
    identifiers: getFieldsByCategory('identifiers'),
    financial: getFieldsByCategory('financial'),
    system: getFieldsByCategory('system')
  };

  // Filter fields based on search
  const filteredFields = fieldSearchTerm ? searchFilterFields(fieldSearchTerm) : null;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const addCondition = (fieldId?: string) => {
    const field = fieldId || ACCOUNT_FILTER_FIELDS[0].id;
    setConditions([...conditions, { field, operator: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const getOperatorsForField = (fieldId: string) => {
    const field = ACCOUNT_FILTER_FIELDS.find(f => f.id === fieldId);
    if (!field) return [{ value: 'equals', label: 'Equals' }];
    
    switch (field.type) {
      case 'text':
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'not_equals', label: 'Not Equals' },
          { value: 'contains', label: 'Contains' },
          { value: 'starts_with', label: 'Starts With' },
          { value: 'is_empty', label: 'Is Empty' },
          { value: 'is_not_empty', label: 'Is Not Empty' },
        ];
      case 'number':
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'not_equals', label: 'Not Equals' },
          { value: 'greater_than', label: 'Greater Than' },
          { value: 'less_than', label: 'Less Than' },
          { value: 'between', label: 'Between' },
        ];
      case 'select':
      case 'multiselect':
        return [
          { value: 'equals', label: 'Is' },
          { value: 'not_equals', label: 'Is Not' },
          { value: 'in', label: 'Is Any Of' },
        ];
      case 'date':
        return [
          { value: 'equals', label: 'On' },
          { value: 'greater_than', label: 'After' },
          { value: 'less_than', label: 'Before' },
          { value: 'between', label: 'Between' },
        ];
      case 'boolean':
        return [
          { value: 'equals', label: 'Is' },
        ];
      default:
        return [{ value: 'equals', label: 'Equals' }];
    }
  };

  const handleSave = () => {
    if (!filterName.trim() || conditions.length === 0) return;
    onSave({ name: filterName, isPublic, conditions });
    setFilterName('');
    setIsPublic(false);
    setConditions([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`absolute right-0 top-0 h-full w-80 bg-white shadow-2xl z-10 flex flex-col transform transition-transform duration-300 ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-2.5 border-b border-gray-200">
          <h2 className="text-xs font-semibold text-gray-900">{editingFilter ? 'Edit Filter' : 'Filter Accounts'}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Active Filters */}
        {/* <div className="p-4 border-b border-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Active Filters</span>
            <button
              onClick={() => setActiveFilters([])}
              className="text-xs text-[#93D500] hover:underline"
            >
              CLEAR ALL
            </button>
          </div>
          {activeFilters.map((filter, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <span className="text-sm flex-1">{filter.field}</span>
              <button
                onClick={() => removeFilter(idx)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div> */}

        {/* Field Search */}
        <div className="p-2.5 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              type="text"
              value={fieldSearchTerm}
              onChange={(e) => setFieldSearchTerm(e.target.value)}
              placeholder="Search fields..."
              className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Field Sections */}
        <div className="flex-1 overflow-y-auto">
          {filteredFields ? (
            // Show search results
            <div className="px-2.5 py-1.5 space-y-0.5">
              {filteredFields.map((field) => (
                <button
                  key={field.id}
                  onClick={() => addCondition(field.id)}
                  className="w-full text-left px-2.5 py-1 text-xs text-gray-600 hover:bg-[#93D500]/10 hover:text-[#93D500] rounded transition-colors"
                >
                  {field.label}
                  <span className="text-[10px] text-gray-400 ml-2">({field.category})</span>
                </button>
              ))}
            </div>
          ) : (
            // Show categorized fields
            Object.entries(fieldsByCategory).map(([section, fields]) => (
              <div key={section} className="border-b border-gray-200">
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full px-2.5 py-1.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    {section}
                  </span>
                  {expandedSections.has(section) ? (
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  )}
                </button>
                
                {expandedSections.has(section) && (
                  <div className="px-2.5 pb-1.5 space-y-0.5">
                    {fields.map((field) => (
                      <button
                        key={field.id}
                        onClick={() => addCondition(field.id)}
                        className="w-full text-left px-2.5 py-1 text-xs text-gray-600 hover:bg-[#93D500]/10 hover:text-[#93D500] rounded transition-colors"
                      >
                        {field.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Filter Conditions */}
        <div className="flex-1 overflow-y-auto p-2.5">
          <div className="space-y-2">
            {conditions.map((condition, index) => {
              const field = ACCOUNT_FILTER_FIELDS.find(f => f.id === condition.field);
              const operators = getOperatorsForField(condition.field);
              
              return (
                <div key={index} className="border border-gray-200 rounded-md p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Condition {index + 1}</span>
                    <button
                      onClick={() => removeCondition(index)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Field Selection */}
                  <select
                    value={condition.field}
                    onChange={(e) => updateCondition(index, { field: e.target.value, operator: 'equals', value: '' })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                  >
                    {ACCOUNT_FILTER_FIELDS.map(f => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                  
                  {/* Operator Selection */}
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(index, { operator: e.target.value as any })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                  >
                    {operators.map(op => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  
                  {/* Value Input */}
                  {(condition.operator === 'is_empty' || condition.operator === 'is_not_empty') ? null : (
                    field?.type === 'select' || field?.type === 'multiselect' || field?.type === 'boolean' ? (
                      <select
                        value={condition.value}
                        onChange={(e) => {
                          // For boolean fields, convert string to actual boolean
                          const val = field.type === 'boolean' 
                            ? e.target.value === 'true' 
                            : e.target.value;
                          updateCondition(index, { value: val });
                        }}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                      >
                        <option value="">Select...</option>
                        {field.options?.map(opt => (
                          <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                        ))}
                      </select>
                    ) : field?.type === 'number' ? (
                      <input
                        type="number"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                        placeholder="Enter value..."
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                      />
                    ) : field?.type === 'date' ? (
                      <input
                        type="date"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                        placeholder="Enter value..."
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                      />
                    )
                  )}
                </div>
              );
            })}
            
            <button
              onClick={() => addCondition()}
              className="w-full px-2.5 py-1.5 border-2 border-dashed border-gray-300 rounded-md text-xs text-gray-600 hover:border-[#93D500] hover:text-[#93D500] transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Condition
            </button>
          </div>
        </div>

        {/* Save Section */}
        <div className="p-2.5 border-t border-gray-200 space-y-2 bg-gray-50">
          <input
            type="text"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Filter name..."
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none text-xs"
          />
          
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-3.5 h-3.5 text-[#93D500] border-gray-300 rounded focus:ring-[#93D500]"
            />
            <span className="text-xs text-gray-700">Make this filter public</span>
          </label>

          <button
            onClick={handleSave}
            disabled={!filterName.trim() || conditions.length === 0}
            className="w-full px-3 py-1.5 bg-[#93D500] text-white rounded-md hover:bg-[#84c000] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors text-xs font-medium"
          >
            <Save className="w-3.5 h-3.5" />
            {editingFilter ? 'Update Filter' : 'Save Filter'}
          </button>
        </div>
    </div>
  );
}
