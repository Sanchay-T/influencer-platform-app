-- Add indexes for fast user search in admin panel
-- These indexes will dramatically speed up ILIKE queries

-- Index for user_id searches (exact matches)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id_search 
ON user_profiles USING btree (user_id text_pattern_ops);

-- Index for full_name searches (starts with and contains)
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name_search 
ON user_profiles USING gin (full_name gin_trgm_ops);

-- Index for business_name searches  
CREATE INDEX IF NOT EXISTS idx_user_profiles_business_name_search 
ON user_profiles USING gin (business_name gin_trgm_ops);

-- Ensure trigram extension is enabled for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Composite index for common admin queries (created_at for ordering)
CREATE INDEX IF NOT EXISTS idx_user_profiles_admin_search 
ON user_profiles (created_at DESC, onboarding_step, trial_status);

-- Index specifically for trial-related admin queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_info 
ON user_profiles (trial_status, trial_start_date, trial_end_date) 
WHERE trial_status != 'pending';

ANALYZE user_profiles;