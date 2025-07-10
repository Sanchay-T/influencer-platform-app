-- Add admin role system to user_profiles table
-- This allows database-based admin management alongside environment variables

-- Add isAdmin field to user_profiles
ALTER TABLE "user_profiles" ADD COLUMN "is_admin" boolean DEFAULT false;

-- Add index for efficient admin queries
CREATE INDEX "idx_user_profiles_is_admin" ON "user_profiles" ("is_admin") WHERE is_admin = true;

-- Add index for admin management queries (admin status + user details)
CREATE INDEX "idx_user_profiles_admin_details" ON "user_profiles" ("is_admin", "full_name", "email", "updated_at");

-- Update the updatedAt timestamp when admin status changes
CREATE OR REPLACE FUNCTION update_admin_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_admin IS DISTINCT FROM NEW.is_admin THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update timestamp on admin status changes
CREATE TRIGGER trigger_update_admin_timestamp
    BEFORE UPDATE OF is_admin ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_timestamp();

-- Optional: Set initial admin status for environment-based admins
-- This will be handled by the application logic, not in SQL

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.is_admin IS 'Database-based admin role. Used alongside NEXT_PUBLIC_ADMIN_EMAILS environment variable.';

-- Analyze table for better query performance
ANALYZE user_profiles;