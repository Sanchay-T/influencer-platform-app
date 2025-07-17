-- Migration to remove Clerk billing fields
-- This migration removes the Clerk billing integration and keeps only Stripe billing

-- Remove Clerk billing columns from user_profiles table
ALTER TABLE user_profiles DROP COLUMN IF EXISTS clerk_customer_id;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS clerk_subscription_id;

-- Update comments on Stripe fields to indicate they are the primary billing system
COMMENT ON COLUMN user_profiles.stripe_customer_id IS 'Stripe customer ID (primary billing system)';
COMMENT ON COLUMN user_profiles.stripe_subscription_id IS 'Stripe subscription ID (primary billing system)';

-- Ensure currentPlan defaults to 'free' for existing users
UPDATE user_profiles 
SET current_plan = 'free' 
WHERE current_plan IS NULL OR current_plan = '';

-- Add index for better performance on billing queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_current_plan ON user_profiles(current_plan);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status ON user_profiles(subscription_status);