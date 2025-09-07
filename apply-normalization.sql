-- =====================================================
-- CLEAN DATABASE NORMALIZATION MIGRATION
-- Create 5 normalized tables without conflicts
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
-- RECORD MIGRATION COMPLETION
-- =====================================================

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

-- Success message
SELECT 'Database normalization completed successfully!' as result;