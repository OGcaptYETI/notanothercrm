-- ============================================
-- DROP OLD SCHEMA
-- Run this FIRST to clean up old tables
-- ============================================

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS prospects CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS saved_filters CASCADE;

-- Drop any old functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Now you can run schema-multitenant.sql
