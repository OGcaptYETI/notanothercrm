-- ============================================
-- AUTO-ASSIGN COMPANY_ID BASED ON EMAIL DOMAIN
-- Trigger function to automatically set company_id for new users
-- ============================================

-- Create function to auto-assign company_id
CREATE OR REPLACE FUNCTION public.auto_assign_company_id()
RETURNS TRIGGER AS $$
DECLARE
  email_domain TEXT;
  assigned_company_id TEXT;
BEGIN
  -- Extract domain from email
  email_domain := split_part(NEW.email, '@', 2);
  
  -- Map email domains to company_ids
  CASE email_domain
    WHEN 'kanvabotanicals.com' THEN
      assigned_company_id := 'kanva-botanicals';
    WHEN 'cwlbrands.com' THEN
      assigned_company_id := 'kanva-botanicals'; -- Same company for now
    ELSE
      -- Unknown domain - don't assign company_id
      -- Admin will need to manually assign
      assigned_company_id := NULL;
  END CASE;
  
  -- If we have a company_id to assign, update user metadata
  IF assigned_company_id IS NOT NULL THEN
    NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'company_id', assigned_company_id,
        'role', COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        'auto_assigned', true,
        'assigned_at', NOW()::text
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created_assign_company ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_company
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_company_id();

-- ============================================
-- OPTIONAL: Update existing users without company_id
-- ============================================

-- Update existing Kanva Botanicals users
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object(
    'company_id', 'kanva-botanicals',
    'role', COALESCE(raw_user_meta_data->>'role', 'user'),
    'auto_assigned', true,
    'assigned_at', NOW()::text
  )
WHERE (email LIKE '%@kanvabotanicals.com' OR email LIKE '%@cwlbrands.com')
  AND (raw_user_meta_data->>'company_id' IS NULL OR raw_user_meta_data->>'company_id' = '');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all users and their company assignments
-- SELECT 
--   id,
--   email,
--   raw_user_meta_data->>'company_id' as company_id,
--   raw_user_meta_data->>'role' as role,
--   raw_user_meta_data->>'auto_assigned' as auto_assigned,
--   created_at
-- FROM auth.users
-- ORDER BY created_at DESC;

-- ============================================
-- FUTURE: Add more companies
-- ============================================

-- To add a new company, just update the CASE statement:
-- WHEN 'newcompany.com' THEN
--   assigned_company_id := 'new-company-id';

-- And make sure the company exists in the companies table:
-- INSERT INTO public.companies (id, name, domain, is_active)
-- VALUES ('new-company-id', 'New Company Name', 'newcompany.com', true);
