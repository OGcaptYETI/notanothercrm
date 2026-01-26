-- ============================================
-- Supabase PostgreSQL Schema
-- CRM Database for KanvaPortal
-- Multi-tenant ready with Row Level Security
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ACCOUNTS TABLE
-- ============================================
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  copper_id INTEGER,
  fishbowl_id TEXT,
  
  -- Core fields
  name TEXT NOT NULL,
  account_number TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  
  -- Address
  shipping_street TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  billing_street TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,
  
  -- Classification (decoded from Copper IDs to names)
  account_type TEXT[], -- Array for multi-select
  region TEXT,
  segment TEXT,
  customer_priority TEXT,
  organization_level TEXT,
  business_model TEXT,
  
  -- Terms
  payment_terms TEXT,
  shipping_terms TEXT,
  carrier_name TEXT,
  
  -- Sales data
  sales_person TEXT,
  total_orders INTEGER,
  total_spent DECIMAL(12,2),
  last_order_date TIMESTAMPTZ,
  first_order_date TIMESTAMPTZ,
  
  -- Primary contact
  primary_contact_id TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  
  -- Copper custom fields
  account_order_id TEXT,
  copper_url TEXT,
  contact_type TEXT,
  inactive_days INTEGER,
  interaction_count INTEGER,
  last_contacted TIMESTAMPTZ,
  owned_by TEXT,
  owner_id INTEGER,
  
  -- Status
  status TEXT NOT NULL,
  is_active_customer BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Indexes for common queries and filters
CREATE INDEX idx_accounts_name ON accounts(name);
CREATE INDEX idx_accounts_region ON accounts(region);
CREATE INDEX idx_accounts_segment ON accounts(segment);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_is_active ON accounts(is_active_customer);
CREATE INDEX idx_accounts_sales_person ON accounts(sales_person);
CREATE INDEX idx_accounts_state ON accounts(shipping_state);
CREATE INDEX idx_accounts_city ON accounts(shipping_city);
CREATE INDEX idx_accounts_account_type ON accounts USING GIN(account_type);
CREATE INDEX idx_accounts_created_at ON accounts(created_at);
CREATE INDEX idx_accounts_updated_at ON accounts(updated_at);

-- Full-text search index
CREATE INDEX idx_accounts_search ON accounts USING gin(
  to_tsvector('english', 
    name || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(phone, '') || ' ' ||
    COALESCE(shipping_city, '') || ' ' ||
    COALESCE(shipping_state, '')
  )
);

-- ============================================
-- CONTACTS TABLE
-- ============================================
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  copper_id INTEGER,
  
  -- Core fields
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  
  -- Account relationship
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  account_name TEXT,
  copper_id_company INTEGER,
  is_primary_contact BOOLEAN DEFAULT false,
  
  -- Address
  street TEXT,
  city TEXT,
  state TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contacts_account_id ON contacts(account_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_name ON contacts(full_name);
CREATE INDEX idx_contacts_search ON contacts USING gin(
  to_tsvector('english', full_name || ' ' || COALESCE(email, ''))
);

-- ============================================
-- PROSPECTS TABLE
-- ============================================
CREATE TABLE prospects (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  copper_id INTEGER,
  
  -- Core fields
  name TEXT NOT NULL,
  company_name TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  
  -- Address
  street TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  
  -- Classification
  account_type TEXT[],
  region TEXT,
  segment TEXT,
  lead_temperature TEXT,
  account_opportunity TEXT,
  
  -- Status
  status TEXT NOT NULL,
  assignee_id TEXT,
  assignee_name TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  follow_up_date TIMESTAMPTZ,
  notes TEXT,
  trade_show_name TEXT
);

-- Indexes
CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_assignee ON prospects(assignee_id);
CREATE INDEX idx_prospects_region ON prospects(region);
CREATE INDEX idx_prospects_search ON prospects USING gin(
  to_tsvector('english', name || ' ' || COALESCE(company_name, '') || ' ' || COALESCE(email, ''))
);

-- ============================================
-- DEALS TABLE
-- ============================================
CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  copper_id INTEGER,
  
  -- Core fields
  name TEXT NOT NULL,
  value DECIMAL(12,2),
  probability INTEGER,
  stage TEXT,
  pipeline_id TEXT,
  
  -- Relationships
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  account_name TEXT,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name TEXT,
  
  -- Status
  status TEXT NOT NULL,
  expected_close_date TIMESTAMPTZ,
  won_date TIMESTAMPTZ,
  lost_date TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Indexes
CREATE INDEX idx_deals_account_id ON deals(account_id);
CREATE INDEX idx_deals_contact_id ON deals(contact_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_expected_close ON deals(expected_close_date);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (For Multi-Tenant SaaS)
-- Currently disabled - will enable when adding company_id
-- ============================================

-- Future: Add company_id to all tables
-- Future: Enable RLS policies per company
-- Future: Add user roles and permissions
