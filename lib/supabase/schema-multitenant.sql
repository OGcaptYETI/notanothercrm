-- ============================================
-- MULTI-TENANT SAAS CRM SCHEMA
-- Supabase PostgreSQL with Row Level Security
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- COMPANIES TABLE (Your SaaS Customers)
-- ============================================
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  
  -- Subscription
  plan TEXT NOT NULL DEFAULT 'trial', -- trial, starter, professional, enterprise
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, cancelled
  trial_ends_at TIMESTAMPTZ,
  subscription_id TEXT,
  
  -- Billing
  stripe_customer_id TEXT,
  billing_email TEXT,
  
  -- Limits
  max_users INTEGER DEFAULT 5,
  max_accounts INTEGER DEFAULT 10000,
  
  -- Features
  features JSONB DEFAULT '{}',
  
  -- Contact
  admin_name TEXT,
  admin_email TEXT,
  admin_phone TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_companies_subdomain ON companies(subdomain);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_stripe_customer ON companies(stripe_customer_id);

-- ============================================
-- ACCOUNTS TABLE (Multi-Tenant)
-- ============================================
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
  
  -- Classification
  account_type TEXT[],
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

-- Indexes
CREATE INDEX idx_accounts_company_id ON accounts(company_id);
CREATE INDEX idx_accounts_name ON accounts(company_id, name);
CREATE INDEX idx_accounts_region ON accounts(company_id, region);
CREATE INDEX idx_accounts_segment ON accounts(company_id, segment);
CREATE INDEX idx_accounts_status ON accounts(company_id, status);
CREATE INDEX idx_accounts_is_active ON accounts(company_id, is_active_customer);
CREATE INDEX idx_accounts_sales_person ON accounts(company_id, sales_person);
CREATE INDEX idx_accounts_state ON accounts(company_id, shipping_state);
CREATE INDEX idx_accounts_city ON accounts(company_id, shipping_city);
CREATE INDEX idx_accounts_account_type ON accounts USING GIN(account_type);
CREATE INDEX idx_accounts_created_at ON accounts(company_id, created_at);

-- Full-text search
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
-- CONTACTS TABLE (Multi-Tenant)
-- ============================================
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_contacts_account_id ON contacts(company_id, account_id);
CREATE INDEX idx_contacts_email ON contacts(company_id, email);
CREATE INDEX idx_contacts_name ON contacts(company_id, full_name);

-- ============================================
-- PROSPECTS TABLE (Multi-Tenant)
-- ============================================
CREATE TABLE prospects (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
CREATE INDEX idx_prospects_company_id ON prospects(company_id);
CREATE INDEX idx_prospects_status ON prospects(company_id, status);
CREATE INDEX idx_prospects_assignee ON prospects(company_id, assignee_id);
CREATE INDEX idx_prospects_region ON prospects(company_id, region);

-- ============================================
-- DEALS TABLE (Multi-Tenant)
-- ============================================
CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
CREATE INDEX idx_deals_company_id ON deals(company_id);
CREATE INDEX idx_deals_account_id ON deals(company_id, account_id);
CREATE INDEX idx_deals_contact_id ON deals(company_id, contact_id);
CREATE INDEX idx_deals_status ON deals(company_id, status);
CREATE INDEX idx_deals_stage ON deals(company_id, stage);

-- ============================================
-- ORDERS TABLE (Multi-Tenant)
-- ============================================
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  fishbowl_order_number TEXT,
  
  -- Customer relationship
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_id TEXT,
  
  -- Order details
  order_date TIMESTAMPTZ,
  ship_date TIMESTAMPTZ,
  status TEXT,
  
  -- Financial
  total_amount DECIMAL(12,2),
  total_tax DECIMAL(12,2),
  shipping_cost DECIMAL(12,2),
  
  -- Sales rep
  sales_person TEXT,
  
  -- Shipping
  shipping_street TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  carrier TEXT,
  tracking_number TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Indexes
CREATE INDEX idx_orders_company_id ON orders(company_id);
CREATE INDEX idx_orders_account_id ON orders(company_id, account_id);
CREATE INDEX idx_orders_customer_id ON orders(company_id, customer_id);
CREATE INDEX idx_orders_order_date ON orders(company_id, order_date);
CREATE INDEX idx_orders_sales_person ON orders(company_id, sales_person);

-- ============================================
-- ORDER LINE ITEMS TABLE (Multi-Tenant)
-- ============================================
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Product details
  product_id TEXT,
  product_name TEXT,
  product_number TEXT,
  
  -- Quantities
  quantity INTEGER,
  unit_price DECIMAL(12,2),
  line_total DECIMAL(12,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_items_company_id ON order_items(company_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(company_id, product_id);

-- ============================================
-- SAVED FILTERS TABLE (Multi-Tenant)
-- ============================================
CREATE TABLE saved_filters (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  
  -- Filter details
  name TEXT NOT NULL,
  description TEXT,
  filter_type TEXT NOT NULL, -- accounts, contacts, prospects, deals
  conditions JSONB NOT NULL,
  
  -- Sharing
  is_public BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_saved_filters_company_id ON saved_filters(company_id);
CREATE INDEX idx_saved_filters_user_id ON saved_filters(company_id, user_id);
CREATE INDEX idx_saved_filters_type ON saved_filters(company_id, filter_type);

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
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_filters_updated_at BEFORE UPDATE ON saved_filters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's company_id from JWT
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id',
    current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'
  )::TEXT;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================
-- COMPANIES POLICIES
-- ============================================

-- Users can only see their own company
CREATE POLICY "Users see only their company"
ON companies FOR SELECT
USING (id = public.user_company_id());

-- Users can update their own company (admins only - will add role check later)
CREATE POLICY "Admins can update their company"
ON companies FOR UPDATE
USING (id = public.user_company_id());

-- ============================================
-- ACCOUNTS POLICIES
-- ============================================

CREATE POLICY "Users see only their company accounts"
ON accounts FOR SELECT
USING (company_id = public.user_company_id());

CREATE POLICY "Users insert only to their company"
ON accounts FOR INSERT
WITH CHECK (company_id = public.user_company_id());

CREATE POLICY "Users update only their company accounts"
ON accounts FOR UPDATE
USING (company_id = public.user_company_id());

CREATE POLICY "Users delete only their company accounts"
ON accounts FOR DELETE
USING (company_id = public.user_company_id());

-- ============================================
-- CONTACTS POLICIES
-- ============================================

CREATE POLICY "Users see only their company contacts"
ON contacts FOR SELECT
USING (company_id = public.user_company_id());

CREATE POLICY "Users insert only to their company"
ON contacts FOR INSERT
WITH CHECK (company_id = public.user_company_id());

CREATE POLICY "Users update only their company contacts"
ON contacts FOR UPDATE
USING (company_id = public.user_company_id());

CREATE POLICY "Users delete only their company contacts"
ON contacts FOR DELETE
USING (company_id = public.user_company_id());

-- ============================================
-- PROSPECTS POLICIES
-- ============================================

CREATE POLICY "Users see only their company prospects"
ON prospects FOR SELECT
USING (company_id = public.user_company_id());

CREATE POLICY "Users insert only to their company"
ON prospects FOR INSERT
WITH CHECK (company_id = public.user_company_id());

CREATE POLICY "Users update only their company prospects"
ON prospects FOR UPDATE
USING (company_id = public.user_company_id());

CREATE POLICY "Users delete only their company prospects"
ON prospects FOR DELETE
USING (company_id = public.user_company_id());

-- ============================================
-- DEALS POLICIES
-- ============================================

CREATE POLICY "Users see only their company deals"
ON deals FOR SELECT
USING (company_id = public.user_company_id());

CREATE POLICY "Users insert only to their company"
ON deals FOR INSERT
WITH CHECK (company_id = public.user_company_id());

CREATE POLICY "Users update only their company deals"
ON deals FOR UPDATE
USING (company_id = public.user_company_id());

CREATE POLICY "Users delete only their company deals"
ON deals FOR DELETE
USING (company_id = public.user_company_id());

-- ============================================
-- ORDERS POLICIES
-- ============================================

CREATE POLICY "Users see only their company orders"
ON orders FOR SELECT
USING (company_id = public.user_company_id());

CREATE POLICY "Users insert only to their company"
ON orders FOR INSERT
WITH CHECK (company_id = public.user_company_id());

CREATE POLICY "Users update only their company orders"
ON orders FOR UPDATE
USING (company_id = public.user_company_id());

-- ============================================
-- ORDER ITEMS POLICIES
-- ============================================

CREATE POLICY "Users see only their company order items"
ON order_items FOR SELECT
USING (company_id = public.user_company_id());

CREATE POLICY "Users insert only to their company"
ON order_items FOR INSERT
WITH CHECK (company_id = public.user_company_id());

-- ============================================
-- SAVED FILTERS POLICIES
-- ============================================

CREATE POLICY "Users see their own and public filters"
ON saved_filters FOR SELECT
USING (
  company_id = public.user_company_id() AND 
  (user_id = auth.uid()::TEXT OR is_public = true)
);

CREATE POLICY "Users insert only to their company"
ON saved_filters FOR INSERT
WITH CHECK (
  company_id = public.user_company_id() AND 
  user_id = auth.uid()::TEXT
);

CREATE POLICY "Users update only their own filters"
ON saved_filters FOR UPDATE
USING (
  company_id = public.user_company_id() AND 
  user_id = auth.uid()::TEXT
);

CREATE POLICY "Users delete only their own filters"
ON saved_filters FOR DELETE
USING (
  company_id = public.user_company_id() AND 
  user_id = auth.uid()::TEXT
);

-- ============================================
-- INITIAL DATA
-- ============================================

-- Create Kanva Botanicals as first company
INSERT INTO companies (
  id, 
  name, 
  subdomain, 
  plan, 
  status,
  admin_name,
  admin_email,
  max_users,
  max_accounts
) VALUES (
  'kanva-botanicals',
  'Kanva Botanicals',
  'kanva',
  'professional',
  'active',
  'Ben Wallner',
  'ben@kanvabotanicals.com',
  999,
  999999
);

-- ============================================
-- USAGE TRACKING (For Billing)
-- ============================================

CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Metrics
  metric_type TEXT NOT NULL, -- accounts_count, users_count, api_calls, storage_mb
  value INTEGER NOT NULL,
  
  -- Timestamp
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_usage_metrics_company ON usage_metrics(company_id, metric_type, period_start);
