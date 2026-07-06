-- Migration: Add user status column (supabase auth bypassed version)
-- Run this in Supabase SQL Editor

-- Add status column (pending, active, rejected)
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Add created_by column to track who created the user
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES admin_users(id);

-- Set default status for existing users to 'active'
UPDATE admin_users SET status = 'active' WHERE status IS NULL;

-- Add constraint for status values
ALTER TABLE admin_users 
DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE admin_users 
ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'rejected'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);
CREATE INDEX IF NOT EXISTS idx_admin_users_created_by ON admin_users(created_by);
