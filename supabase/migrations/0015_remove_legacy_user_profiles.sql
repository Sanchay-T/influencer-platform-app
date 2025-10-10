-- =====================================================
-- FINAL CLEANUP: Remove legacy user_profiles table
-- Safe removal after successful normalization
-- =====================================================

-- Step 1: Create backup table (just in case)
CREATE TABLE user_profiles_backup AS 
SELECT * FROM user_profiles;

-- Step 2: Add comment to backup table
COMMENT ON TABLE user_profiles_backup IS 'Backup of original user_profiles table before normalization cleanup - Created automatically during migration';

-- Step 3: Remove the old monolithic table
DROP TABLE user_profiles;

-- Step 4: Update schema comments for documentation
COMMENT ON TABLE users IS 'Core user identity and profile information - Normalized from user_profiles';
COMMENT ON TABLE user_subscriptions IS 'User subscription and trial management - Normalized from user_profiles';  
COMMENT ON TABLE user_billing IS 'User billing and payment information - Normalized from user_profiles';
COMMENT ON TABLE user_usage IS 'User plan limits and usage tracking - Normalized from user_profiles';
COMMENT ON TABLE user_system_data IS 'User system events and webhook data - Normalized from user_profiles';

-- Step 5: Final verification function
CREATE OR REPLACE FUNCTION verify_normalization_complete() 
RETURNS TABLE(
  status TEXT,
  message TEXT
) AS $$
BEGIN
  -- Check if backup exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles_backup') THEN
    RETURN QUERY SELECT 'ERROR'::TEXT, 'Backup table not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check if old table is gone
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
    RETURN QUERY SELECT 'ERROR'::TEXT, 'Old user_profiles table still exists'::TEXT;
    RETURN;
  END IF;
  
  -- Check if all normalized tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') OR
     NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions' AND table_schema = 'public') OR
     NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_billing' AND table_schema = 'public') OR
     NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_usage' AND table_schema = 'public') OR
     NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_system_data' AND table_schema = 'public') THEN
    RETURN QUERY SELECT 'ERROR'::TEXT, 'Some normalized tables are missing'::TEXT;
    RETURN;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT 'SUCCESS'::TEXT, 'Database normalization completed successfully! Old monolithic table removed, backup preserved.'::TEXT;
END;
$$ LANGUAGE plpgsql;