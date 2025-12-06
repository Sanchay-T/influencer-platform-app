const { Client } = require('pg');

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function main() {
  const dbUrl = env('DATABASE_URL');
  const ssl = /supabase|amazonaws|pooler|\.co:/.test(dbUrl);
  const client = new Client({ connectionString: dbUrl, ssl: ssl ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    const plans = [
      {
        plan_key: 'glow_up', display_name: 'Glow Up Plan', description: 'Perfect for growing creators and small businesses',
        monthly_price: 9900, yearly_price: 94800,
        stripe_monthly_price_id: env('STRIPE_GLOW_UP_MONTHLY_PRICE_ID'),
        stripe_yearly_price_id: env('STRIPE_GLOW_UP_YEARLY_PRICE_ID'),
        campaigns_limit: 3, creators_limit: 1000,
        features: { platforms: ['TikTok','Instagram','YouTube'], exportFormats: ['CSV'], emailExtraction: true, bioExtraction: true, support: 'email' }, sort_order: 1, is_active: true
      },
      {
        plan_key: 'viral_surge', display_name: 'Viral Surge Plan', description: 'For agencies and serious marketers',
        monthly_price: 24900, yearly_price: 238800,
        stripe_monthly_price_id: env('STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID'),
        stripe_yearly_price_id: env('STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID'),
        campaigns_limit: 10, creators_limit: 10000,
        features: { platforms: ['TikTok','Instagram','YouTube'], exportFormats: ['CSV','Excel'], emailExtraction: true, bioExtraction: true, advancedFiltering: true, prioritySupport: true, support: 'priority' }, sort_order: 2, is_active: true
      },
      {
        plan_key: 'fame_flex', display_name: 'Fame Flex Plan', description: 'Unlimited power for enterprise users',
        monthly_price: 49900, yearly_price: 478800,
        stripe_monthly_price_id: env('STRIPE_FAME_FLEX_MONTHLY_PRICE_ID'),
        stripe_yearly_price_id: env('STRIPE_FAME_FLEX_YEARLY_PRICE_ID'),
        campaigns_limit: -1, creators_limit: -1,
        features: { platforms: ['TikTok','Instagram','YouTube'], exportFormats: ['CSV','Excel','JSON'], emailExtraction: true, bioExtraction: true, advancedFiltering: true, customIntegrations: true, dedicatedSupport: true, apiAccess: true, support: 'dedicated' }, sort_order: 3, is_active: true
      }
    ];

    for (const p of plans) {
      const query = `
        INSERT INTO subscription_plans (
          plan_key, display_name, description,
          monthly_price, yearly_price,
          stripe_monthly_price_id, stripe_yearly_price_id,
          campaigns_limit, creators_limit,
          features, is_active, sort_order, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12, now(), now())
        ON CONFLICT (plan_key) DO UPDATE SET
          display_name=EXCLUDED.display_name,
          description=EXCLUDED.description,
          monthly_price=EXCLUDED.monthly_price,
          yearly_price=EXCLUDED.yearly_price,
          stripe_monthly_price_id=EXCLUDED.stripe_monthly_price_id,
          stripe_yearly_price_id=EXCLUDED.stripe_yearly_price_id,
          campaigns_limit=EXCLUDED.campaigns_limit,
          creators_limit=EXCLUDED.creators_limit,
          features=EXCLUDED.features,
          is_active=EXCLUDED.is_active,
          sort_order=EXCLUDED.sort_order,
          updated_at=now();
      `;
      const values = [
        p.plan_key, p.display_name, p.description,
        p.monthly_price, p.yearly_price,
        p.stripe_monthly_price_id, p.stripe_yearly_price_id,
        p.campaigns_limit, p.creators_limit,
        JSON.stringify(p.features), p.is_active, p.sort_order
      ];
      await client.query(query, values);
      console.log('Upserted plan:', p.plan_key);
    }

    const res = await client.query('SELECT plan_key, campaigns_limit, creators_limit FROM subscription_plans ORDER BY sort_order');
    console.log('Plans:', res.rows);
  } finally {
    await client.end();
  }
}

require('dotenv').config({ path: '.env.local' });
main().catch(e => { console.error(e); process.exit(1); });

