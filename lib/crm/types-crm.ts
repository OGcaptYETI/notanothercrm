/**
 * Unified CRM Types for People, Tasks, Opportunities, Leads
 * Based on exact Supabase schema
 */

// ============================================
// PEOPLE (Contacts)
// ============================================
export interface Person {
  id: string;
  company_id: string;
  source: string;
  
  // Core identity
  first_name: string | null;
  last_name: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  
  // Company association
  company_name: string | null;
  account_id: string | null;
  
  // Address
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  
  // Contact details (JSONB arrays)
  phone_numbers: Array<{category: string; number: string}>;
  emails: Array<{category: string; email: string}>;
  websites: Array<{category: string; url: string}>;
  socials: Array<{category: string; url: string}>;
  
  // Copper metadata
  copper_id: number | null;
  contact_type_id: number | null;
  assignee_id: number | null;
  owner_id: number | null;
  interaction_count: number;
  
  // Custom fields
  region: string | null;
  segment: string | null;
  account_type: string[] | null;
  customer_priority: string | null;
  organization_level: string | null;
  account_number: string | null;
  account_order_id: string | null;
  
  // Tracking
  date_created: string | null;
  date_modified: string | null;
  imported_at: string;
  synced_from_copper_api_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// TASKS
// ============================================
export interface Task {
  id: string;
  company_id: string;
  source: string;
  
  // Core fields
  name: string;
  details: string | null;
  status: string | null;
  priority: string | null;
  
  // Relationships
  parent_task_id: string | null;
  related_to_type: string | null;
  related_to_id: string | null;
  account_id: string | null;
  person_id: string | null;
  opportunity_id: string | null;
  
  // Ownership
  owner: string | null;
  owner_id: number | null;
  assignee_id: number | null;
  
  // Dates
  due_date: string | null;
  completed_at: string | null;
  reminder_date: string | null;
  
  // Copper metadata
  copper_id: number | null;
  tags: string | null;
  
  // Custom fields
  account_number: string | null;
  account_order_id: string | null;
  
  // Tracking
  created_at: string;
  updated_at: string;
  imported_at: string;
}

// ============================================
// OPPORTUNITIES
// ============================================
export interface Opportunity {
  id: string;
  company_id: string;
  source: string;
  
  // Core fields
  name: string;
  details: string | null;
  value: number | null;
  
  // Pipeline & Status
  pipeline: string | null;
  stage: string | null;
  status: string | null;
  win_probability: number | null;
  priority: string | null;
  loss_reason: string | null;
  
  // Relationships
  account_id: string | null;
  company_name: string | null;
  primary_contact: string | null;
  primary_contact_id: string | null;
  
  // Ownership
  owner: string | null;
  owner_id: number | null;
  assignee_id: number | null;
  
  // Dates
  close_date: string | null;
  completed_date: string | null;
  lead_created_at: string | null;
  last_stage_at: string | null;
  days_in_stage: number | null;
  inactive_days: number | null;
  
  // Financial details
  converted_value: number | null;
  currency: string | null;
  exchange_rate: number | null;
  
  // Order details
  so_number: string | null;
  account_order_id: string | null;
  customer_po: string | null;
  
  // Shipping
  shipping_amount: number | null;
  shipping_status: string | null;
  shipping_method: string | null;
  ship_date: string | null;
  delivery_date: string | null;
  tracking_number: string | null;
  carrier: string | null;
  
  // Financial breakdown
  subtotal: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  order_total: number | null;
  
  // Payment
  payment_terms: string | null;
  payment_status: string | null;
  
  // Products
  products_involved: string | null;
  
  // Copper metadata
  copper_id: number | null;
  copper_url: string | null;
  tags: string | null;
  interaction_count: number;
  last_contacted: string | null;
  
  // Custom fields
  region: string | null;
  segment: string | null;
  account_type: string | null;
  customer_priority: string | null;
  business_model: string | null;
  account_number: string | null;
  sale_type: string | null;
  
  // Sync tracking
  sync_status: string | null;
  fishbowl_status: string | null;
  
  // Tracking
  created_at: string;
  updated_at: string;
  imported_at: string;
}

// ============================================
// LEADS
// ============================================
export interface Lead {
  id: string;
  company_id: string;
  source: string;
  
  // Core identity
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  
  // Company/Account
  account: string | null;
  company: string | null;
  account_number: string | null;
  
  // Address
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  
  // Lead details
  status: string | null;
  lead_temperature: string | null;
  value: number | null;
  
  // Conversion tracking
  converted_at: string | null;
  converted_contact_id: string | null;
  converted_opportunity_id: string | null;
  converted_value: number | null;
  
  // Ownership
  owned_by: string | null;
  owner_id: number | null;
  
  // Activity
  last_status_at: string | null;
  last_contacted: string | null;
  follow_up_date: string | null;
  inactive_days: number;
  interaction_count: number;
  
  // Classification
  region: string | null;
  segment: string | null;
  customer_priority: string | null;
  business_model: string | null;
  account_type: string | null;
  
  // Details
  details: string | null;
  prospect_notes: string | null;
  
  // Copper metadata
  copper_id: number | null;
  copper_url: string | null;
  tags: string | null;
  
  // Contact details
  work_email: string | null;
  website: string | null;
  
  // Tracking
  created_at: string;
  updated_at: string;
  imported_at: string;
}

// ============================================
// SHARED TYPES
// ============================================
export type CRMEntity = Person | Task | Opportunity | Lead;

export type EntityType = 'people' | 'tasks' | 'opportunities' | 'leads' | 'accounts';

export interface EntityCounts {
  total: number;
  [key: string]: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number | null;
  hasMore: boolean;
}
