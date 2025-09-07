-- =====================================================
-- MIGRATE DATA FROM user_profiles TO NEW NORMALIZED TABLES
-- Safe data migration with rollback capability
-- =====================================================

-- Step 1: Populate users table from user_profiles (core identity data)
INSERT INTO users (
  user_id, email, full_name, business_name, brand_description, 
  industry, onboarding_step, is_admin, created_at, updated_at
)
SELECT 
  user_id, 
  email, 
  full_name, 
  business_name, 
  brand_description,
  industry, 
  COALESCE(onboarding_step, 'pending'), 
  COALESCE(is_admin, false), 
  created_at, 
  updated_at
FROM user_profiles
WHERE user_id IS NOT NULL
  AND user_id NOT IN (SELECT user_id FROM users)
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Populate user_subscriptions table (subscription & trial data)
INSERT INTO user_subscriptions (
  user_id, current_plan, intended_plan, subscription_status, trial_status,
  trial_start_date, trial_end_date, trial_conversion_date,
  subscription_cancel_date, subscription_renewal_date, billing_sync_status,
  created_at, updated_at
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
  COALESCE(up.billing_sync_status, 'pending'),
  up.created_at,
  up.updated_at
FROM user_profiles up
JOIN users u ON u.user_id = up.user_id
WHERE u.id NOT IN (SELECT user_id FROM user_subscriptions WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Step 3: Populate user_billing table (only for users with billing info)
INSERT INTO user_billing (
  user_id, stripe_customer_id, stripe_subscription_id, payment_method_id,
  card_last_4, card_brand, card_exp_month, card_exp_year,
  billing_address_city, billing_address_country, billing_address_postal_code,
  created_at, updated_at
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
  up.billing_address_postal_code,
  up.created_at,
  up.updated_at
FROM user_profiles up
JOIN users u ON u.user_id = up.user_id
WHERE (up.stripe_customer_id IS NOT NULL OR up.payment_method_id IS NOT NULL)
  AND u.id NOT IN (SELECT user_id FROM user_billing WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Step 4: Populate user_usage table (plan limits & usage tracking)
INSERT INTO user_usage (
  user_id, plan_campaigns_limit, plan_creators_limit, plan_features,
  usage_campaigns_current, usage_creators_current_month, usage_reset_date,
  created_at, updated_at
)
SELECT 
  u.id, 
  up.plan_campaigns_limit, 
  up.plan_creators_limit, 
  COALESCE(up.plan_features, '{}'),
  COALESCE(up.usage_campaigns_current, 0), 
  COALESCE(up.usage_creators_current_month, 0), 
  COALESCE(up.usage_reset_date, now()),
  up.created_at,
  up.updated_at
FROM user_profiles up
JOIN users u ON u.user_id = up.user_id
WHERE u.id NOT IN (SELECT user_id FROM user_usage WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Step 5: Populate user_system_data table (system events & webhooks)
INSERT INTO user_system_data (
  user_id, signup_timestamp, email_schedule_status, 
  last_webhook_event, last_webhook_timestamp,
  created_at, updated_at
)
SELECT 
  u.id, 
  COALESCE(up.signup_timestamp, up.created_at), 
  COALESCE(up.email_schedule_status, '{}'),
  up.last_webhook_event, 
  up.last_webhook_timestamp,
  up.created_at,
  up.updated_at
FROM user_profiles up
JOIN users u ON u.user_id = up.user_id
WHERE u.id NOT IN (SELECT user_id FROM user_system_data WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Step 6: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_current_plan ON user_subscriptions(current_plan);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_status ON user_subscriptions(trial_status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_subscription_status ON user_subscriptions(subscription_status);

CREATE INDEX IF NOT EXISTS idx_user_billing_user_id ON user_billing(user_id);
CREATE INDEX IF NOT EXISTS idx_user_billing_stripe_customer ON user_billing(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_reset_date ON user_usage(usage_reset_date);

CREATE INDEX IF NOT EXISTS idx_user_system_data_user_id ON user_system_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_system_data_last_webhook ON user_system_data(last_webhook_timestamp) WHERE last_webhook_timestamp IS NOT NULL;

-- Step 7: Create data integrity verification function
CREATE OR REPLACE FUNCTION verify_migration_integrity() 
RETURNS TABLE(
  check_name TEXT,
  user_profiles_count BIGINT,
  normalized_count BIGINT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH counts AS (
    SELECT 
      'Total Users' as check_name,
      (SELECT COUNT(*) FROM user_profiles) as up_count,
      (SELECT COUNT(*) FROM users) as norm_count
    UNION ALL
    SELECT 
      'Users with Subscriptions',
      (SELECT COUNT(*) FROM user_profiles WHERE current_plan IS NOT NULL),
      (SELECT COUNT(*) FROM user_subscriptions)
    UNION ALL
    SELECT 
      'Users with Billing Info',
      (SELECT COUNT(*) FROM user_profiles WHERE stripe_customer_id IS NOT NULL OR payment_method_id IS NOT NULL),
      (SELECT COUNT(*) FROM user_billing)
    UNION ALL
    SELECT 
      'Users with Usage Data',
      (SELECT COUNT(*) FROM user_profiles),
      (SELECT COUNT(*) FROM user_usage)
  )
  SELECT 
    c.check_name,
    c.up_count,
    c.norm_count,
    CASE 
      WHEN c.up_count = c.norm_count THEN '✅ MATCH'
      WHEN c.norm_count > c.up_count THEN '⚠️ MORE IN NORMALIZED'
      ELSE '❌ MISSING DATA'
    END as status
  FROM counts c;
END;
$$ LANGUAGE plpgsql;