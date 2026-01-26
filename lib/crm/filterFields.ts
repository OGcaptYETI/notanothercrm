/**
 * Complete field definitions for CRM filtering
 * Maps all copper_companies fields to filterable UI fields
 */

import {
  REGION_OPTIONS,
  ACCOUNT_TYPE_OPTIONS,
  SEGMENT_OPTIONS,
  CUSTOMER_PRIORITY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  SHIPPING_TERMS_OPTIONS,
  CARRIER_OPTIONS,
  BUSINESS_MODEL_OPTIONS,
  ORGANIZATION_LEVEL_OPTIONS,
  ACCOUNT_OPPORTUNITY_OPTIONS,
  ORDER_FREQUENCY_OPTIONS,
  STATE_OPTIONS,
} from './customFields';

export interface FilterFieldOption {
  value: string;
  label: string;
}

export interface FilterField {
  id: string; // Firestore field name
  label: string; // Display name
  type: 'text' | 'select' | 'multiselect' | 'date' | 'number' | 'boolean';
  category: 'interactions' | 'details' | 'identifiers' | 'financial' | 'system';
  options?: FilterFieldOption[];
  firestoreField: string; // Actual Firestore field path
}

// Convert custom field options to filter options
const toFilterOptions = (options: Array<{ id: number; name: string }>): FilterFieldOption[] => {
  return options.map(opt => ({ value: opt.name, label: opt.name }));
};

export const ACCOUNT_FILTER_FIELDS: FilterField[] = [
  // INTERACTIONS
  {
    id: 'dateCreated',
    label: 'Date Added',
    type: 'date',
    category: 'interactions',
    firestoreField: 'dateCreated'
  },
  {
    id: 'dateModified',
    label: 'Last Modified',
    type: 'date',
    category: 'interactions',
    firestoreField: 'dateModified'
  },
  {
    id: 'lastOrderDate',
    label: 'Last Order Date',
    type: 'date',
    category: 'interactions',
    firestoreField: 'lastOrderDate'
  },
  {
    id: 'firstOrderDate',
    label: 'First Order Date',
    type: 'date',
    category: 'interactions',
    firestoreField: 'firstOrderDate'
  },
  {
    id: 'salesPerson',
    label: 'Sales Person',
    type: 'text',
    category: 'interactions',
    firestoreField: 'salesPerson'
  },

  // DETAILS
  {
    id: 'name',
    label: 'Account Name',
    type: 'text',
    category: 'details',
    firestoreField: 'name'
  },
  {
    id: 'email',
    label: 'Email',
    type: 'text',
    category: 'details',
    firestoreField: 'email'
  },
  {
    id: 'phone',
    label: 'Phone',
    type: 'text',
    category: 'details',
    firestoreField: 'phone'
  },
  {
    id: 'website',
    label: 'Website',
    type: 'text',
    category: 'details',
    firestoreField: 'website'
  },
  {
    id: 'shippingCity',
    label: 'City',
    type: 'text',
    category: 'details',
    firestoreField: 'shippingCity'
  },
  {
    id: 'shippingState',
    label: 'State',
    type: 'select',
    category: 'details',
    options: toFilterOptions(STATE_OPTIONS),
    firestoreField: 'shippingState'
  },
  {
    id: 'shippingZip',
    label: 'Zip Code',
    type: 'text',
    category: 'details',
    firestoreField: 'shippingZip'
  },
  {
    id: 'shippingStreet',
    label: 'Street Address',
    type: 'text',
    category: 'details',
    firestoreField: 'shippingStreet'
  },
  {
    id: 'notes',
    label: 'Notes',
    type: 'text',
    category: 'details',
    firestoreField: 'notes'
  },

  // IDENTIFIERS
  {
    id: 'accountNumber',
    label: 'Account Number',
    type: 'text',
    category: 'identifiers',
    firestoreField: 'accountNumber'
  },
  {
    id: 'copperId',
    label: 'Copper ID',
    type: 'number',
    category: 'identifiers',
    firestoreField: 'copperId'
  },
  {
    id: 'accountOrderId',
    label: 'Account Order ID',
    type: 'text',
    category: 'identifiers',
    firestoreField: 'accountOrderId'
  },
  {
    id: 'accountType',
    label: 'Account Type',
    type: 'multiselect',
    category: 'identifiers',
    options: toFilterOptions(ACCOUNT_TYPE_OPTIONS),
    firestoreField: 'accountType'
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    category: 'identifiers',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
    firestoreField: 'status'
  },
  {
    id: 'region',
    label: 'Region',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(REGION_OPTIONS),
    firestoreField: 'region'
  },
  {
    id: 'segment',
    label: 'Segment',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(SEGMENT_OPTIONS),
    firestoreField: 'segment'
  },
  {
    id: 'customerPriority',
    label: 'Customer Priority',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(CUSTOMER_PRIORITY_OPTIONS),
    firestoreField: 'customerPriority'
  },
  {
    id: 'organizationLevel',
    label: 'Organization Level',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(ORGANIZATION_LEVEL_OPTIONS),
    firestoreField: 'organizationLevel'
  },
  {
    id: 'businessModel',
    label: 'Business Model',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(BUSINESS_MODEL_OPTIONS),
    firestoreField: 'businessModel'
  },

  // FINANCIAL
  {
    id: 'totalSpent',
    label: 'Total Spent',
    type: 'number',
    category: 'financial',
    firestoreField: 'totalSpent'
  },
  {
    id: 'totalOrders',
    label: 'Total Orders',
    type: 'number',
    category: 'financial',
    firestoreField: 'totalOrders'
  },
  {
    id: 'averageOrderValue',
    label: 'Average Order Value',
    type: 'number',
    category: 'financial',
    firestoreField: 'averageOrderValue'
  },
  {
    id: 'creditLimit',
    label: 'Credit Limit',
    type: 'number',
    category: 'financial',
    firestoreField: 'creditLimit'
  },
  {
    id: 'paymentTerms',
    label: 'Payment Terms',
    type: 'select',
    category: 'financial',
    options: toFilterOptions(PAYMENT_TERMS_OPTIONS),
    firestoreField: 'paymentTerms'
  },
  {
    id: 'accountOpportunity',
    label: 'Account Opportunity',
    type: 'select',
    category: 'financial',
    options: toFilterOptions(ACCOUNT_OPPORTUNITY_OPTIONS),
    firestoreField: 'accountOpportunity'
  },

  // SYSTEM
  {
    id: 'shippingTerms',
    label: 'Shipping Terms',
    type: 'select',
    category: 'system',
    options: toFilterOptions(SHIPPING_TERMS_OPTIONS),
    firestoreField: 'shippingTerms'
  },
  {
    id: 'carrierName',
    label: 'Carrier',
    type: 'select',
    category: 'system',
    options: toFilterOptions(CARRIER_OPTIONS),
    firestoreField: 'carrierName'
  },
  {
    id: 'orderFrequency',
    label: 'Order Frequency',
    type: 'select',
    category: 'system',
    options: toFilterOptions(ORDER_FREQUENCY_OPTIONS),
    firestoreField: 'orderFrequency'
  },
  {
    id: 'source',
    label: 'Data Source',
    type: 'select',
    category: 'system',
    options: [
      { value: 'fishbowl', label: 'Fishbowl' },
      { value: 'copper', label: 'Copper' },
      { value: 'manual', label: 'Manual' },
    ],
    firestoreField: 'source'
  },
];

// Helper to get field by ID
export function getFilterField(fieldId: string): FilterField | undefined {
  return ACCOUNT_FILTER_FIELDS.find(f => f.id === fieldId);
}

// Helper to get fields by category
export function getFieldsByCategory(category: string): FilterField[] {
  return ACCOUNT_FILTER_FIELDS.filter(f => f.category === category);
}

// Helper to search fields
export function searchFilterFields(searchTerm: string): FilterField[] {
  if (!searchTerm) return ACCOUNT_FILTER_FIELDS;
  
  const term = searchTerm.toLowerCase();
  return ACCOUNT_FILTER_FIELDS.filter(field =>
    field.label.toLowerCase().includes(term) ||
    field.id.toLowerCase().includes(term)
  );
}
