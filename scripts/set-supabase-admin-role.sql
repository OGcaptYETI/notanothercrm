-- Set admin role for user in Supabase
-- Run this in Supabase Dashboard → SQL Editor

-- First, check current user metadata
SELECT id, email, raw_user_meta_data
FROM auth.users
WHERE email = 'ben@kanvabotanicals.com'; -- Replace with your email

-- Update user metadata to set admin role
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'ben@kanvabotanicals.com'; -- Replace with your email

-- Also set full_name if not set
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{full_name}',
  '"Ben Wallner"'
)
WHERE email = 'ben@kanvabotanicals.com'; -- Replace with your email

-- Verify the update
SELECT id, email, raw_user_meta_data
FROM auth.users
WHERE email = 'ben@kanvabotanicals.com'; -- Replace with your email
