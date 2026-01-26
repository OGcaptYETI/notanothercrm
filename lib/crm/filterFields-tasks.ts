/**
 * Filter field definitions for Tasks
 * Uses exact Supabase column names (snake_case)
 */

import type { FilterField } from './filterFields';

export const TASKS_FILTER_FIELDS: FilterField[] = [
  // CORE
  {
    id: 'name',
    label: 'Task Name',
    type: 'text',
    category: 'details',
    supabaseColumn: 'name'
  },
  {
    id: 'details',
    label: 'Details',
    type: 'text',
    category: 'details',
    supabaseColumn: 'details'
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    category: 'details',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    supabaseColumn: 'status'
  },
  {
    id: 'priority',
    label: 'Priority',
    type: 'select',
    category: 'details',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' },
    ],
    supabaseColumn: 'priority'
  },

  // RELATIONSHIPS
  {
    id: 'related_to_type',
    label: 'Related To Type',
    type: 'select',
    category: 'identifiers',
    options: [
      { value: 'account', label: 'Account' },
      { value: 'person', label: 'Person' },
      { value: 'opportunity', label: 'Opportunity' },
      { value: 'lead', label: 'Lead' },
    ],
    supabaseColumn: 'related_to_type'
  },
  {
    id: 'related_to_id',
    label: 'Related To ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'related_to_id'
  },
  {
    id: 'account_id',
    label: 'Account ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_id'
  },
  {
    id: 'person_id',
    label: 'Person ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'person_id'
  },
  {
    id: 'opportunity_id',
    label: 'Opportunity ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'opportunity_id'
  },

  // OWNERSHIP
  {
    id: 'owner',
    label: 'Owner',
    type: 'text',
    category: 'system',
    supabaseColumn: 'owner'
  },
  {
    id: 'owner_id',
    label: 'Owner ID',
    type: 'number',
    category: 'system',
    supabaseColumn: 'owner_id'
  },
  {
    id: 'assignee_id',
    label: 'Assignee ID',
    type: 'number',
    category: 'system',
    supabaseColumn: 'assignee_id'
  },

  // DATES
  {
    id: 'due_date',
    label: 'Due Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'due_date'
  },
  {
    id: 'completed_at',
    label: 'Completed At',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'completed_at'
  },
  {
    id: 'reminder_date',
    label: 'Reminder Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'reminder_date'
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
    id: 'tags',
    label: 'Tags',
    type: 'text',
    category: 'details',
    supabaseColumn: 'tags'
  },
  {
    id: 'account_number',
    label: 'Account Number',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_number'
  },
  {
    id: 'account_order_id',
    label: 'Account Order ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_order_id'
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
