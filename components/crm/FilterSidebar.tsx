'use client';

import { useState } from 'react';
import { X, Save, Plus, ChevronDown, ChevronRight } from 'lucide-react';

interface FilterField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number';
  options?: Array<{ value: string; label: string }>;
}

interface FilterCondition {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than' | 'between' | 'in';
  value: any;
}

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filter: { name: string; isPublic: boolean; conditions: FilterCondition[] }) => void;
  fields?: FilterField[];
}

const DEFAULT_FIELDS: FilterField[] = [
  { id: 'name', label: 'Account Name', type: 'text' },
  { id: 'accountNumber', label: 'Account Number', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'phone', label: 'Phone', type: 'text' },
  { id: 'shippingCity', label: 'City', type: 'text' },
  { id: 'shippingState', label: 'State', type: 'text' },
  { id: 'region', label: 'Region', type: 'select', options: [
    { value: 'Pacific Northwest', label: 'Pacific Northwest' },
    { value: 'South Central', label: 'South Central' },
    { value: 'Northeast', label: 'Northeast' },
    { value: 'Southeast', label: 'Southeast' },
    { value: 'Midwest', label: 'Midwest' },
    { value: 'Mountain', label: 'Mountain' },
  ]},
  { id: 'segment', label: 'Segment', type: 'select', options: [
    { value: 'Wholesale', label: 'Wholesale' },
    { value: 'Distributor', label: 'Distributor' },
    { value: 'Smoke & Vape', label: 'Smoke & Vape' },
  ]},
  { id: 'status', label: 'Status', type: 'select', options: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]},
  { id: 'salesPerson', label: 'Sales Person', type: 'text' },
  { id: 'totalSpent', label: 'Total Spent', type: 'number' },
];

export function FilterSidebar({ isOpen, onClose, onSave, fields = DEFAULT_FIELDS }: FilterSidebarProps) {
  const [filterName, setFilterName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['interactions']));

  const fieldSections = {
    interactions: ['Activity Type', 'Last Contacted', 'Inactive Days', 'Owned By (I)', 'Followed'],
    details: ['Date Added', 'Contact Type', 'City', 'State', 'Country', 'Zip', 'Name', 'Description'],
    identifiers: ['Account ID', 'Account Notes', 'Account Order ID (I)', 'Account Type', 'Account Type (NEW)', 'Active Customer'],
    financial: ['Average Order Value', 'Credit Limit', 'Customer Since', 'Days Since Last Order'],
    system: ['Display ID', 'Distributor Notes', 'First Order Date', 'Fishbowl Assigned Sales Person', 'Geo Lat', 'Geo Long']
  };

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

  const addCondition = () => {
    setConditions([...conditions, { field: fields[0].id, operator: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const getOperatorsForField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return ['equals'];
    
    switch (field.type) {
      case 'text':
        return ['equals', 'contains', 'starts_with'];
      case 'number':
        return ['equals', 'greater_than', 'less_than', 'between'];
      case 'select':
        return ['equals', 'in'];
      case 'date':
        return ['equals', 'greater_than', 'less_than', 'between'];
      default:
        return ['equals'];
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
          <h2 className="text-xs font-semibold text-gray-900">Filter Accounts</h2>
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

        {/* Field Sections */}
        <div className="flex-1 overflow-y-auto">
          {Object.entries(fieldSections).map(([section, fieldNames]) => (
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
                  {fieldNames.map((fieldName) => (
                    <button
                      key={fieldName}
                      onClick={() => addCondition()}
                      className="w-full text-left px-2.5 py-1 text-xs text-gray-600 hover:bg-[#93D500]/10 hover:text-[#93D500] rounded transition-colors"
                    >
                      {fieldName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Filter Conditions */}
        <div className="flex-1 overflow-y-auto p-2.5">
          <div className="space-y-2">
            {conditions.map((condition, index) => {
              const field = fields.find(f => f.id === condition.field);
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
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                  >
                    {fields.map(f => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                  
                  {/* Operator Selection */}
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(index, { operator: e.target.value as any })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                  >
                    {operators.map(op => (
                      <option key={op} value={op}>
                        {op.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                  
                  {/* Value Input */}
                  {field?.type === 'select' ? (
                    <select
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                    >
                      <option value="">Select...</option>
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field?.type === 'number' ? (
                    <input
                      type="number"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      placeholder="Enter value..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      placeholder="Enter value..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#93D500] focus:border-transparent outline-none"
                    />
                  )}
                </div>
              );
            })}
            
            <button
              onClick={addCondition}
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
            Save Filter
          </button>
        </div>
    </div>
  );
}
