-- =====================================================
-- PHASE 1: DATABASE NORMALIZATION MIGRATION
-- Normalize user_profiles "god table" into 5 focused tables
-- =====================================================

-- 1. USERS TABLE - Core identity and profile information
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text UNIQUE NOT NULL,  -- External auth ID (Clerk)
    email text,
    full_name text,
    business_name text,
    brand_description text,
    industry text,
    onboarding_step varchar DEFAULT 'pending' NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL,
    
    -- Constraints
    CONSTRAINT check_onboarding_step 
        CHECK (onboarding_step IN ('pending', 'info_captured', 'intent_captured', 'completed'))
);

-- 2. USER_SUBSCRIPTIONS TABLE - Trial and subscription management
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_plan varchar DEFAULT 'free' NOT NULL,
    intended_plan varchar,  -- Plan selected before checkout
    subscription_status varchar DEFAULT 'none' NOT NULL,
    trial_status varchar DEFAULT 'pending' NOT NULL,
    trial_start_date timestamp,
    trial_end_date timestamp,
    trial_conversion_date timestamp,
    subscription_cancel_date timestamp,
    subscription_renewal_date timestamp,
    billing_sync_status varchar DEFAULT 'pending' NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL,
    
    -- Constraints
    CONSTRAINT check_subscription_status 
        CHECK (subscription_status IN ('none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
    CONSTRAINT check_trial_status 
        CHECK (trial_status IN ('pending', 'active', 'expired', 'cancelled', 'converted')),
    CONSTRAINT check_current_plan 
        CHECK (current_plan IN ('free', 'glow_up', 'viral_surge', 'fame_flex')),
    CONSTRAINT check_billing_sync_status
        CHECK (billing_sync_status IN ('pending', 'synced', 'error'))
);

-- 3. USER_BILLING TABLE - Stripe payment data (Clerk artifacts removed)
CREATE TABLE IF NOT EXISTS user_billing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id text UNIQUE,
    stripe_subscription_id text,
    payment_method_id text,
    card_last_4 varchar(4),
    card_brand varchar(20),
    card_exp_month integer,
    card_exp_year integer,
    billing_address_city text,
    billing_address_country varchar(2),
    billing_address_postal_code varchar(20),
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

-- 4. USER_USAGE TABLE - Usage tracking and plan limits
CREATE TABLE IF NOT EXISTS user_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_campaigns_limit integer,
    plan_creators_limit integer,
    plan_features jsonb DEFAULT '{}' NOT NULL,
    usage_campaigns_current integer DEFAULT 0 NOT NULL,
    usage_creators_current_month integer DEFAULT 0 NOT NULL,
    usage_reset_date timestamp DEFAULT now() NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

-- 5. USER_SYSTEM_DATA TABLE - System metadata and webhook tracking
CREATE TABLE IF NOT EXISTS user_system_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signup_timestamp timestamp DEFAULT now() NOT NULL,
    email_schedule_status jsonb DEFAULT '{}' NOT NULL,
    last_webhook_event varchar(100),
    last_webhook_timestamp timestamp,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(onboarding_step);
CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin) WHERE is_admin = true;

-- User subscriptions indexes  
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_current_plan ON user_subscriptions(current_plan);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_status ON user_subscriptions(trial_status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_subscription_status ON user_subscriptions(subscription_status);

-- User billing indexes
CREATE INDEX IF NOT EXISTS idx_user_billing_user_id ON user_billing(user_id);
CREATE INDEX IF NOT EXISTS idx_user_billing_stripe_customer ON user_billing(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_billing_stripe_subscription ON user_billing(stripe_subscription_id);

-- User usage indexes
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_reset_date ON user_usage(usage_reset_date);

-- User system data indexes
CREATE INDEX IF NOT EXISTS idx_user_system_data_user_id ON user_system_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_system_data_signup ON user_system_data(signup_timestamp);

-- =====================================================
-- DATA MIGRATION FROM user_profiles
-- (Only runs if user_profiles table exists and has data)
-- =====================================================

-- Check if user_profiles exists and has data
DO $$ 
DECLARE 
    table_exists boolean;
    row_count integer;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Check if table has data
        SELECT COUNT(*) FROM user_profiles INTO row_count;
        
        IF row_count > 0 THEN
            RAISE NOTICE 'Migrating % rows from user_profiles to normalized tables', row_count;
            
            -- 1. Migrate to users table
            INSERT INTO users (
                user_id, email, full_name, business_name, brand_description, 
                industry, onboarding_step, is_admin, created_at, updated_at
            )
            SELECT DISTINCT
                user_id, 
                email, 
                full_name, 
                business_name, 
                brand_description,
                industry, 
                COALESCE(onboarding_step, 'pending'), 
                COALESCE(is_admin, false), 
                COALESCE(created_at, now()), 
                COALESCE(updated_at, now())
            FROM user_profiles
            WHERE user_id IS NOT NULL
            ON CONFLICT (user_id) DO NOTHING;

            -- 2. Migrate to user_subscriptions table
            INSERT INTO user_subscriptions (
                user_id, current_plan, intended_plan, subscription_status, trial_status,
                trial_start_date, trial_end_date, trial_conversion_date,
                subscription_cancel_date, subscription_renewal_date, billing_sync_status
            )
            SELECT 
                u.id, 
                COALESCE(up.current_plan, 'free'), 
                up.intended_plan,
                COALESCE(up.subscription_status, 'none'), 
                COALESCE(up.trial_status, 'pending'),
                up.trial_start_date, 
                up.trial_end_date, 
                up.trial_conversion_date,
                up.subscription_cancel_date, 
                up.subscription_renewal_date,
                COALESCE(up.billing_sync_status, 'pending')
            FROM user_profiles up
            JOIN users u ON u.user_id = up.user_id
            ON CONFLICT (user_id) DO NOTHING;

            -- 3. Migrate to user_billing table  
            INSERT INTO user_billing (
                user_id, stripe_customer_id, stripe_subscription_id, payment_method_id,
                card_last_4, card_brand, card_exp_month, card_exp_year,
                billing_address_city, billing_address_country, billing_address_postal_code
            )
            SELECT 
                u.id, 
                up.stripe_customer_id, 
                up.stripe_subscription_id, 
                up.payment_method_id,
                up.card_last_4, 
                up.card_brand, 
                up.card_exp_month, 
                up.card_exp_year,
                up.billing_address_city, 
                up.billing_address_country, 
                up.billing_address_postal_code
            FROM user_profiles up
            JOIN users u ON u.user_id = up.user_id
            WHERE up.stripe_customer_id IS NOT NULL 
               OR up.stripe_subscription_id IS NOT NULL
               OR up.payment_method_id IS NOT NULL
            ON CONFLICT (user_id) DO NOTHING;

            -- 4. Migrate to user_usage table
            INSERT INTO user_usage (
                user_id, plan_campaigns_limit, plan_creators_limit, plan_features,
                usage_campaigns_current, usage_creators_current_month, usage_reset_date
            )
            SELECT 
                u.id, 
                up.plan_campaigns_limit, 
                up.plan_creators_limit, 
                COALESCE(up.plan_features, '{}'),
                COALESCE(up.usage_campaigns_current, 0), 
                COALESCE(up.usage_creators_current_month, 0), 
                COALESCE(up.usage_reset_date, now())
            FROM user_profiles up
            JOIN users u ON u.user_id = up.user_id
            ON CONFLICT (user_id) DO NOTHING;

            -- 5. Migrate to user_system_data table
            INSERT INTO user_system_data (
                user_id, signup_timestamp, email_schedule_status, 
                last_webhook_event, last_webhook_timestamp
            )
            SELECT 
                u.id, 
                COALESCE(up.signup_timestamp, up.created_at, now()), 
                COALESCE(up.email_schedule_status, '{}'),
                up.last_webhook_event, 
                up.last_webhook_timestamp
            FROM user_profiles up
            JOIN users u ON u.user_id = up.user_id
            ON CONFLICT (user_id) DO NOTHING;
            
            RAISE NOTICE 'Data migration completed successfully';
        ELSE
            RAISE NOTICE 'user_profiles table exists but is empty - no data to migrate';
        END IF;
    ELSE
        RAISE NOTICE 'user_profiles table does not exist - creating empty normalized structure';
    END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Add comments to document the new structure
COMMENT ON TABLE users IS 'Core user identity and profile information';
COMMENT ON TABLE user_subscriptions IS 'Trial and subscription management';
COMMENT ON TABLE user_billing IS 'Stripe billing data (Clerk artifacts removed)';
COMMENT ON TABLE user_usage IS 'Usage tracking and plan limits';
COMMENT ON TABLE user_system_data IS 'System metadata and webhook tracking';

-- Record migration completion
INSERT INTO system_configurations (category, key, value, value_type, description, is_hot_reloadable)
VALUES (
    'database', 
    'user_tables_normalized', 
    'true', 
    'boolean', 
    'Flag indicating user_profiles has been normalized into 5 tables',
    'false'
) ON CONFLICT (category, key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = now();