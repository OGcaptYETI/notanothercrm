/**
 * Filter field definitions for Opportunities
 * Uses exact Supabase column names (snake_case)
 */

import {
  REGION_OPTIONS,
  SEGMENT_OPTIONS,
  CUSTOMER_PRIORITY_OPTIONS,
  BUSINESS_MODEL_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  SHIPPING_TERMS_OPTIONS,
  CARRIER_OPTIONS,
} from './customFields';
import type { FilterField } from './filterFields';

const toFilterOptions = (options: Array<{ id: number; name: string }>) => {
  return options.map(opt => ({ value: opt.name, label: opt.name }));
};

export const OPPORTUNITIES_FILTER_FIELDS: FilterField[] = [
  // CORE
  {
    id: 'name',
    label: 'Opportunity Name',
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
    id: 'value',
    label: 'Value',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'value'
  },

  // PIPELINE & STATUS
  {
    id: 'pipeline',
    label: 'Pipeline',
    type: 'text',
    category: 'details',
    supabaseColumn: 'pipeline'
  },
  {
    id: 'stage',
    label: 'Stage',
    type: 'text',
    category: 'details',
    supabaseColumn: 'stage'
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    category: 'details',
    options: [
      { value: 'Won', label: 'Won' },
      { value: 'Lost', label: 'Lost' },
      { value: 'Open', label: 'Open' },
      { value: 'Pending', label: 'Pending' },
    ],
    supabaseColumn: 'status'
  },
  {
    id: 'win_probability',
    label: 'Win Probability',
    type: 'number',
    category: 'details',
    supabaseColumn: 'win_probability'
  },
  {
    id: 'priority',
    label: 'Priority',
    type: 'select',
    category: 'details',
    options: [
      { value: 'None', label: 'None' },
      { value: 'Low', label: 'Low' },
      { value: 'Medium', label: 'Medium' },
      { value: 'High', label: 'High' },
    ],
    supabaseColumn: 'priority'
  },
  {
    id: 'loss_reason',
    label: 'Loss Reason',
    type: 'text',
    category: 'details',
    supabaseColumn: 'loss_reason'
  },

  // RELATIONSHIPS
  {
    id: 'account_id',
    label: 'Account ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_id'
  },
  {
    id: 'company_name',
    label: 'Company Name',
    type: 'text',
    category: 'details',
    supabaseColumn: 'company_name'
  },
  {
    id: 'primary_contact',
    label: 'Primary Contact',
    type: 'text',
    category: 'details',
    supabaseColumn: 'primary_contact'
  },
  {
    id: 'primary_contact_id',
    label: 'Primary Contact ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'primary_contact_id'
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
    id: 'close_date',
    label: 'Close Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'close_date'
  },
  {
    id: 'completed_date',
    label: 'Completed Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'completed_date'
  },
  {
    id: 'lead_created_at',
    label: 'Lead Created At',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'lead_created_at'
  },
  {
    id: 'last_stage_at',
    label: 'Last Stage At',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'last_stage_at'
  },
  {
    id: 'days_in_stage',
    label: 'Days in Stage',
    type: 'number',
    category: 'details',
    supabaseColumn: 'days_in_stage'
  },
  {
    id: 'inactive_days',
    label: 'Inactive Days',
    type: 'number',
    category: 'details',
    supabaseColumn: 'inactive_days'
  },

  // FINANCIAL
  {
    id: 'converted_value',
    label: 'Converted Value',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'converted_value'
  },
  {
    id: 'currency',
    label: 'Currency',
    type: 'text',
    category: 'financial',
    supabaseColumn: 'currency'
  },
  {
    id: 'exchange_rate',
    label: 'Exchange Rate',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'exchange_rate'
  },
  {
    id: 'subtotal',
    label: 'Subtotal',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'subtotal'
  },
  {
    id: 'tax_amount',
    label: 'Tax Amount',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'tax_amount'
  },
  {
    id: 'discount_amount',
    label: 'Discount Amount',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'discount_amount'
  },
  {
    id: 'order_total',
    label: 'Order Total',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'order_total'
  },

  // ORDER DETAILS
  {
    id: 'so_number',
    label: 'SO Number',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'so_number'
  },
  {
    id: 'account_order_id',
    label: 'Account Order ID',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_order_id'
  },
  {
    id: 'customer_po',
    label: 'Customer PO',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'customer_po'
  },

  // SHIPPING
  {
    id: 'shipping_amount',
    label: 'Shipping Amount',
    type: 'number',
    category: 'financial',
    supabaseColumn: 'shipping_amount'
  },
  {
    id: 'shipping_status',
    label: 'Shipping Status',
    type: 'text',
    category: 'details',
    supabaseColumn: 'shipping_status'
  },
  {
    id: 'shipping_method',
    label: 'Shipping Method',
    type: 'select',
    category: 'details',
    options: toFilterOptions(SHIPPING_TERMS_OPTIONS),
    supabaseColumn: 'shipping_method'
  },
  {
    id: 'ship_date',
    label: 'Ship Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'ship_date'
  },
  {
    id: 'delivery_date',
    label: 'Delivery Date',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'delivery_date'
  },
  {
    id: 'tracking_number',
    label: 'Tracking Number',
    type: 'text',
    category: 'details',
    supabaseColumn: 'tracking_number'
  },
  {
    id: 'carrier',
    label: 'Carrier',
    type: 'select',
    category: 'details',
    options: toFilterOptions(CARRIER_OPTIONS),
    supabaseColumn: 'carrier'
  },

  // PAYMENT
  {
    id: 'payment_terms',
    label: 'Payment Terms',
    type: 'select',
    category: 'financial',
    options: toFilterOptions(PAYMENT_TERMS_OPTIONS),
    supabaseColumn: 'payment_terms'
  },
  {
    id: 'payment_status',
    label: 'Payment Status',
    type: 'text',
    category: 'financial',
    supabaseColumn: 'payment_status'
  },

  // PRODUCTS
  {
    id: 'products_involved',
    label: 'Products Involved',
    type: 'text',
    category: 'details',
    supabaseColumn: 'products_involved'
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
  {
    id: 'interaction_count',
    label: 'Interaction Count',
    type: 'number',
    category: 'interactions',
    supabaseColumn: 'interaction_count'
  },
  {
    id: 'last_contacted',
    label: 'Last Contacted',
    type: 'date',
    category: 'interactions',
    supabaseColumn: 'last_contacted'
  },

  // CUSTOM FIELDS
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
    id: 'account_type',
    label: 'Account Type',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_type'
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
    id: 'account_number',
    label: 'Account Number',
    type: 'text',
    category: 'identifiers',
    supabaseColumn: 'account_number'
  },
  {
    id: 'sale_type',
    label: 'Sale Type',
    type: 'text',
    category: 'details',
    supabaseColumn: 'sale_type'
  },

  // SYNC TRACKING
  {
    id: 'sync_status',
    label: 'Sync Status',
    type: 'text',
    category: 'system',
    supabaseColumn: 'sync_status'
  },
  {
    id: 'fishbowl_status',
    label: 'Fishbowl Status',
    type: 'text',
    category: 'system',
    supabaseColumn: 'fishbowl_status'
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
