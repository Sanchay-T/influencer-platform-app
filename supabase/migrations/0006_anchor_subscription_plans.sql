-- Ensure canonical subscription plans exist with expected usage limits.
-- Stripe price IDs default to placeholders so environments can override them later
-- via admin tools or scripts without breaking the not-null constraint.
INSERT INTO subscription_plans (
  plan_key,
  display_name,
  description,
  monthly_price,
  yearly_price,
  stripe_monthly_price_id,
  stripe_yearly_price_id,
  campaigns_limit,
  creators_limit,
  features,
  is_active,
  sort_order,
  created_at,
  updated_at
) VALUES
  (
    'glow_up',
    'Glow Up Plan',
    'Perfect for growing creators and small businesses',
    9900,
    94800,
    'pending_glow_up_monthly',
    'pending_glow_up_yearly',
    3,
    1000,
    '{"platforms":["TikTok","Instagram","YouTube"],"exportFormats":["CSV"],"emailExtraction":true,"bioExtraction":true,"support":"email"}'::jsonb,
    true,
    1,
    now(),
    now()
  ),
  (
    'viral_surge',
    'Viral Surge Plan',
    'For agencies and serious marketers',
    24900,
    238800,
    'pending_viral_surge_monthly',
    'pending_viral_surge_yearly',
    10,
    10000,
    '{"platforms":["TikTok","Instagram","YouTube"],"exportFormats":["CSV","Excel"],"emailExtraction":true,"bioExtraction":true,"advancedFiltering":true,"prioritySupport":true,"support":"priority"}'::jsonb,
    true,
    2,
    now(),
    now()
  ),
  (
    'fame_flex',
    'Fame Flex Plan',
    'Unlimited power for enterprise users',
    49900,
    478800,
    'pending_fame_flex_monthly',
    'pending_fame_flex_yearly',
    -1,
    -1,
    '{"platforms":["TikTok","Instagram","YouTube"],"exportFormats":["CSV","Excel","JSON"],"emailExtraction":true,"bioExtraction":true,"advancedFiltering":true,"customIntegrations":true,"dedicatedSupport":true,"apiAccess":true,"support":"dedicated"}'::jsonb,
    true,
    3,
    now(),
    now()
  )
ON CONFLICT (plan_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  campaigns_limit = EXCLUDED.campaigns_limit,
  creators_limit = EXCLUDED.creators_limit,
  features = EXCLUDED.features,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
