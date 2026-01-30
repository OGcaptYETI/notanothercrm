-- Add sync tracking fields to accounts table
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS synced_from_firebase_at TIMESTAMPTZ;

-- Create index for sync queries
CREATE INDEX IF NOT EXISTS idx_accounts_synced_firebase 
ON accounts(synced_from_firebase_at);

-- Also add to other CRM tables if they exist
ALTER TABLE people 
ADD COLUMN IF NOT EXISTS synced_from_firebase_at TIMESTAMPTZ;

ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS synced_from_firebase_at TIMESTAMPTZ;

-- Verify fields were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
AND column_name LIKE '%firebase%';
