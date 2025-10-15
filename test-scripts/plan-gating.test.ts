import './helpers/load-env'

import { buildTestAuthHeaders } from '@/lib/tests/agent-auth'
import postgres from 'postgres'

type PlanScenario = {
  label: string
  planKey: string | null
  expectedCampaignLimit: number | 'unlimited'
}

const SCENARIOS: PlanScenario[] = [
  { label: 'free', planKey: null, expectedCampaignLimit: 0 },
  { label: 'glow_up', planKey: 'glow_up', expectedCampaignLimit: 3 },
  { label: 'viral_surge', planKey: 'viral_surge', expectedCampaignLimit: 10 },
  { label: 'fame_flex', planKey: 'fame_flex', expectedCampaignLimit: 'unlimited' },
]

const BASE_URL = process.env.PLAN_TEST_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'

if (!BASE_URL) {
  console.error('BASE_URL could not be determined. Set PLAN_TEST_BASE_URL or NEXT_PUBLIC_SITE_URL.')
  process.exit(1)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function apiFetch(userId: string, email: string, path: string, init?: RequestInit) {
  const headers = buildTestAuthHeaders({ userId, email })
  const merged: RequestInit = {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...headers,
      ...(init?.headers ?? {}),
    },
  }
  const res = await fetch(`${BASE_URL}${path}`, merged)
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    // ignore
  }
  return { res, text, json }
}

async function completeOnboarding(userId: string, email: string, planKey: string | null) {
  const fullName = `QA ${planKey ?? 'Free'} User`
  const businessName = `${planKey ?? 'Free'} Biz`

  let response = await apiFetch(userId, email, '/api/onboarding/step-1', {
    method: 'PATCH',
    body: JSON.stringify({ fullName, businessName }),
  })
  assert(response.res.ok, `step-1 failed: ${response.text}`)

  await waitForProfile(userId, email)

  response = await apiFetch(userId, email, '/api/onboarding/step-2', {
    method: 'PATCH',
    body: JSON.stringify({ brandDescription: `${planKey ?? 'Free'} brand description` }),
  })
  assert(response.res.ok, `step-2 failed: ${response.text}`)

  if (planKey) {
    response = await apiFetch(userId, email, '/api/onboarding/save-plan', {
      method: 'POST',
      body: JSON.stringify({ selectedPlan: planKey }),
    })
    assert(response.res.ok, `/api/onboarding/save-plan failed: ${response.text}`)
  }

  response = await apiFetch(userId, email, '/api/onboarding/complete', {
    method: 'PATCH',
    body: JSON.stringify({ completed: true }),
  })
  assert(response.res.ok, `/api/onboarding/complete failed: ${response.text}`)

  return response.json
}

async function fetchBillingStatus(userId: string, email: string) {
  const { res, json, text } = await apiFetch(userId, email, '/api/billing/status')
  assert(res.ok, `/api/billing/status failed: ${text}`)
  return json
}

async function waitForProfile(userId: string, email: string) {
  const attempts = 6
  for (let i = 0; i < attempts; i++) {
    const { res } = await apiFetch(userId, email, '/api/onboarding/status')
    if (res.ok) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('Profile not found after step 1')
}

async function mockStripeSubscription(userId: string, planKey: string) {
  const databaseUrl = process.env.DATABASE_URL
  assert(databaseUrl, 'DATABASE_URL is required to run plan gating tests')

  const sql = postgres(databaseUrl, { max: 1 })
  try {
    const rows = await sql`select id from users where user_id = ${userId}`
    assert(rows.length === 1, `User ${userId} not found in database`)
    const userPk = rows[0].id

    const stripeCustomerId = `cus_${userId}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)
    const stripeSubscriptionId = `sub_${userId}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)

    const billingRows = await sql`select id from user_billing where user_id = ${userPk}`
    if (billingRows.length) {
      await sql`update user_billing set stripe_customer_id = ${stripeCustomerId}, stripe_subscription_id = ${stripeSubscriptionId}, updated_at = now() where user_id = ${userPk}`
    } else {
      await sql`insert into user_billing (user_id, stripe_customer_id, stripe_subscription_id, created_at, updated_at) values (${userPk}, ${stripeCustomerId}, ${stripeSubscriptionId}, now(), now())`
    }

    const now = new Date()
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    await sql`
      update user_subscriptions
      set current_plan = ${planKey},
          intended_plan = ${planKey},
          subscription_status = 'trialing',
          trial_status = 'active',
          trial_start_date = coalesce(trial_start_date, ${now}),
          trial_end_date = coalesce(trial_end_date, ${trialEnd}),
          updated_at = now()
      where user_id = ${userPk}
    `
  } finally {
    await sql.end({ timeout: 1 })
  }
}

function verifyTrialWindow(billing: any) {
  const startIso = billing?.trialStartDate ?? billing?.trial?.startDate
  const endIso = billing?.trialEndDate ?? billing?.trial?.endDate
  assert(typeof startIso === 'string' && typeof endIso === 'string', 'trial start/end date missing')
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  assert(Number.isFinite(start) && Number.isFinite(end), 'trial dates are not parseable')
  const diffDays = (end - start) / (1000 * 60 * 60 * 24)
  assert(Math.abs(diffDays - 7) < 0.05, `trial length expected ~7 days, received ${diffDays.toFixed(3)} days`)
}

async function createCampaign(userId: string, email: string, name: string) {
  return apiFetch(userId, email, '/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name, searchType: 'keyword' }),
  })
}

async function runScenario(scenario: PlanScenario) {
  const userId = `plan_test_${scenario.label}_${Date.now()}`
  const email = `${userId}@example.com`

  console.log(`\n[${scenario.label}] Starting onboarding flow for ${userId}`)

  await completeOnboarding(userId, email, scenario.planKey)

  if (scenario.planKey) {
    await mockStripeSubscription(userId, scenario.planKey)
  }

  const billing = await fetchBillingStatus(userId, email)
  const expectedPlan = scenario.planKey ?? 'free'
  assert(billing.currentPlan === expectedPlan, `Expected currentPlan ${expectedPlan}, received ${billing.currentPlan}`)

  if (scenario.planKey) {
    verifyTrialWindow(billing)
  }

  if (scenario.expectedCampaignLimit === 'unlimited') {
    console.log(`[${scenario.label}] Verifying unlimited campaign creation`)
    for (let i = 1; i <= 12; i++) {
      const { res, text } = await createCampaign(userId, email, `Unlimited Campaign ${i}`)
      assert(res.ok, `Campaign ${i} should succeed for unlimited plan. Response: ${text}`)
    }
  } else {
    const limit = scenario.expectedCampaignLimit
    console.log(`[${scenario.label}] Verifying campaign limit of ${limit}`)
    for (let i = 1; i <= limit; i++) {
      const { res, text } = await createCampaign(userId, email, `Campaign ${i}`)
      assert(res.ok, `Campaign ${i} should succeed. Response: ${text}`)
    }
    const { res, text, json } = await createCampaign(userId, email, `Campaign ${limit + 1}`)
    assert(res.status === 403, `Campaign ${limit + 1} should be blocked with 403. Response: ${text}`)
    const message = (json?.message || '').toLowerCase()
    assert(
      typeof json?.message === 'string' && (message.includes('limit') || message.includes('upgrade') || message.includes('trial')),
      'Limit block message missing or unexpected'
    )
  }

  console.log(`[${scenario.label}] ✅ Passed`)
}

async function main() {
  const failures: string[] = []
  for (const scenario of SCENARIOS) {
    try {
      await runScenario(scenario)
    } catch (error) {
      failures.push(`${scenario.label}: ${(error as Error).message}`)
      console.error(`[${scenario.label}] ❌ Failed`, error)
    }
  }

  if (failures.length) {
    console.error('\nPlan gating test suite FAILED')
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exit(1)
  }

  console.log('\n🎉 Plan gating test suite passed')
}

main().catch((err) => {
  console.error('Plan gating test suite crashed:', err)
  process.exit(1)
})
