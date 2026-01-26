/**
 * Filter field definitions for Leads
 * Uses exact Supabase column names (snake_case)
 */

import {
  REGION_OPTIONS,
  SEGMENT_OPTIONS,
  CUSTOMER_PRIORITY_OPTIONS,
  BUSINESS_MODEL_OPTIONS,
  STATE_OPTIONS,
} from './customFields';
import type { FilterField } from './filterFields';

const toFilterOptions = (options: Array<{ id: number; name: string }>) => {
  return options.map(opt => ({ value: opt.name, label: opt.name }));
};

export const LEADS_FILTER_FIELDS: FilterField[] = [
  // IDENTITY
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
    id: 'name',
    label: 'Full Name',
    type: 'text',
    category: 'details',
    supabaseColumn: 'name'
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
  {
    id: 'title',
    label: 'Job Title',
    type: 'text',
    category: 'details',
    supabaseColumn: 'title'
  },

  // COMPANY/ACCOUNT
  {
    id: 'account',
    label: 'Account',
    type: 'text',
    category: 'details',
    supabaseColumn: 'account'
  },
  {
    id: 'company',
    label: 'Company',
    type: 'text',
    category: 'details',
    supabaseColumn: 'company'
  },
  {
    id: 'account_number',
    label: 'Account Number',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_number'
  },

  // ADDRESS
  {
    id: 'street',
    label: 'Street',
    type: 'text',
    category: 'details',
    supabaseColumn: 'street'
  },
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

  // LEAD DETAILS
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    category: 'details',
    options: [
      { value: 'New', label: 'New' },
      { value: 'Contacted', label: 'Contacted' },
      { value: 'Qualified', label: 'Qualified' },
      { value: 'Unqualified', label: 'Unqualified' },
      { value: 'Converted', label: 'Converted' },
    ],
    supabaseColumn: 'status'
  },
  {
    id: 'lead_temperature',
    label: 'Lead Temperature',
    type: 'select',
    category: 'details',
    options: [
      { value: 'Cold', label: 'Cold' },
      { value: 'Warm', label: 'Warm' },
      { value: 'Hot', label: 'Hot' },
    ],
    supabaseColumn: 'lead_temperature'
  },
  {
    id: 'value',
    label: 'Value',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'value'
  },

  // CONVERSION TRACKING
  {
    id: 'converted_at',
    label: 'Converted At',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'converted_at'
  },
  {
    id: 'converted_contact_id',
    label: 'Converted Contact ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'converted_contact_id'
  },
  {
    id: 'converted_opportunity_id',
    label: 'Converted Opportunity ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'converted_opportunity_id'
  },
  {
    id: 'converted_value',
    label: 'Converted Value',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'converted_value'
  },

  // OWNERSHIP
  {
    id: 'owned_by',
    label: 'Owned By',
    type: 'text',
    category: 'system',
    supabaseColumn: 'owned_by'
  },
  {
    id: 'owner_id',
    label: 'Owner ID',
    type: 'number',
    category: 'system',
    supabaseColumn: 'owner_id'
  },

  // ACTIVITY
  {
    id: 'last_status_at',
    label: 'Last Status At',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'last_status_at'
  },
  {
    id: 'last_contacted',
    label: 'Last Contacted',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'last_contacted'
  },
  {
    id: 'follow_up_date',
    label: 'Follow Up Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'follow_up_date'
  },
  {
    id: 'inactive_days',
    label: 'Inactive Days',
    type: 'number',
    category: 'details',
    supabaseColumn: 'inactive_days'
  },
  {
    id: 'interaction_count',
    label: 'Interaction Count',
    type: 'number',
    category: 'interactions',
    supabaseColumn: 'interaction_count'
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
    id: 'business_model',
    label: 'Business Model',
    type: 'select',
    category: 'identifiers',
    options: toFilterOptions(BUSINESS_MODEL_OPTIONS),
    supabaseColumn: 'business_model'
  },
  {
    id: 'account_type',
    label: 'Account Type',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_type'
  },

  // DETAILS
  {
    id: 'details',
    label: 'Details',
    type: 'text',
    category: 'details',
    supabaseColumn: 'details'
  },
  {
    id: 'prospect_notes',
    label: 'Prospect Notes',
    type: 'text',
    category: 'details',
    supabaseColumn: 'prospect_notes'
  },

  // COPPER METADATA
  {
    id: 'copper_id',
    label: 'Copper ID',
    type: 'number',
    category: 'system',
    supabaseColumn: 'copper_id'
  },
  {
    id: 'copper_url',
    label: 'Copper URL',
    type: 'text',
    category: 'system',
    supabaseColumn: 'copper_url'
  },
  {
    id: 'tags',
    label: 'Tags',
    type: 'text',
    category: 'details',
    supabaseColumn: 'tags'
  },

  // CONTACT DETAILS
  {
    id: 'work_email',
    label: 'Work Email',
    type: 'text',
    category: 'details',
    supabaseColumn: 'work_email'
  },
  {
    id: 'website',
    label: 'Website',
    type: 'text',
    category: 'details',
    supabaseColumn: 'website'
  },

  // TRACKING
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
  {
    id: 'imported_at',
    label: 'Imported At',
    type: 'date',
    category: 'system',
    supabaseColumn: 'imported_at'
  },
];
