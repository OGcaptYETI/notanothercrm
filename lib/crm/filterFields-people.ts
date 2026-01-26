/**
 * Filter field definitions for People (Contacts)
 * Uses exact Supabase column names (snake_case)
 */

import {
  REGION_OPTIONS,
  ACCOUNT_TYPE_OPTIONS,
  SEGMENT_OPTIONS,
  CUSTOMER_PRIORITY_OPTIONS,
  ORGANIZATION_LEVEL_OPTIONS,
  STATE_OPTIONS,
} from './customFields';
import type { FilterField } from './filterFields';

const toFilterOptions = (options: Array<{ id: number; name: string }>) => {
  return options.map(opt => ({ value: opt.name, label: opt.name }));
};

export const PEOPLE_FILTER_FIELDS: FilterField[] = [
  // IDENTITY
  {
    id: 'name',
    label: 'Full Name',
    type: 'text',
    category: 'details',
    supabaseColumn: 'name'
  },
  {
    id: 'first_name',
    label: 'First Name',
    type: 'text',
    category: 'details',
    supabaseColumn: 'first_name'
  },
  {
    id: 'last_name',
    label: 'Last Name',
    type: 'text',
    category: 'details',
    supabaseColumn: 'last_name'
  },
  {
    id: 'title',
    label: 'Job Title',
    type: 'text',
    category: 'details',
    supabaseColumn: 'title'
  },
  {
    id: 'email',
    label: 'Email',
    type: 'text',
    category: 'details',
    supabaseColumn: 'email'
  },
  {
    id: 'phone',
    label: 'Phone',
    type: 'text',
    category: 'details',
    supabaseColumn: 'phone'
  },

  // COMPANY
  {
    id: 'company_name',
    label: 'Company Name',
    type: 'text',
    category: 'details',
    supabaseColumn: 'company_name'
  },
  {
    id: 'account_id',
    label: 'Account ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_id'
  },

  // ADDRESS
  {
    id: 'city',
    label: 'City',
    type: 'text',
    category: 'details',
    supabaseColumn: 'city'
  },
  {
    id: 'state',
    label: 'State',
    type: 'select',
    category: 'details',
    options: toFilterOptions(STATE_OPTIONS),
    supabaseColumn: 'state'
  },
  {
    id: 'postal_code',
    label: 'Postal Code',
    type: 'text',
    category: 'details',
    supabaseColumn: 'postal_code'
  },
  {
    id: 'country',
    label: 'Country',
    type: 'text',
    category: 'details',
    supabaseColumn: 'country'
  },

  // CLASSIFICATION
  {
    id: 'region',
    label: 'Region',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(REGION_OPTIONS),
    supabaseColumn: 'region'
  },
  {
    id: 'segment',
    label: 'Segment',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(SEGMENT_OPTIONS),
    supabaseColumn: 'segment'
  },
  {
    id: 'customer_priority',
    label: 'Customer Priority',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(CUSTOMER_PRIORITY_OPTIONS),
    supabaseColumn: 'customer_priority'
  },
  {
    id: 'organization_level',
    label: 'Organization Level',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(ORGANIZATION_LEVEL_OPTIONS),
    supabaseColumn: 'organization_level'
  },

  // METADATA
  {
    id: 'copper_id',
    label: 'Copper ID',
    type: 'number',
    category: 'system',
    supabaseColumn: 'copper_id'
  },
  {
    id: 'assignee_id',
    label: 'Assignee ID',
    type: 'number',
    category: 'system',
    supabaseColumn: 'assignee_id'
  },
  {
    id: 'owner_id',
    label: 'Owner ID',
    type: 'number',
    category: 'system',
    supabaseColumn: 'owner_id'
  },
  {
    id: 'interaction_count',
    label: 'Interaction Count',
    type: 'number',
    category: 'interactions',
    supabaseColumn: 'interaction_count'
  },

  // DATES
  {
    id: 'date_created',
    label: 'Date Created',
    type: 'date',
    category: 'system',
    supabaseColumn: 'date_created'
  },
  {
    id: 'date_modified',
    label: 'Date Modified',
    type: 'date',
    category: 'system',
    supabaseColumn: 'date_modified'
  },
  {
    id: 'created_at',
    label: 'Created At',
    type: 'date',
    category: 'system',
    supabaseColumn: 'created_at'
  },
  {
    id: 'updated_at',
    label: 'Updated At',
    type: 'date',
    category: 'system',
    supabaseColumn: 'updated_at'
  },
];
