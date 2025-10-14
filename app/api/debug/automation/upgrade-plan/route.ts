import { NextRequest, NextResponse } from 'next/server'
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test'
import { BillingService, PLAN_CONFIGS, PlanKey } from '@/lib/services/billing-service'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const { userId: bodyUserId, plan = 'fame_flex', stripeCustomerId, stripeSubscriptionId, priceId } =
    await req.json().catch(() => ({}))

  const { userId: authUserId } = await getAuthOrTest()
  const targetUserId = bodyUserId || authUserId

  if (!targetUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const planKey = plan as PlanKey
  const planConfig = PLAN_CONFIGS[planKey]
  if (!planConfig) {
    return NextResponse.json({ error: `Invalid plan key: ${plan}` }, { status: 400 })
  }

  const resolvedPriceId =
    priceId ||
    planConfig.stripeMontlyPriceId ||
    planConfig.stripeYearlyPriceId ||
    `price_automation_${planKey}`

  const stripeData = {
    customerId: stripeCustomerId || `cus_automation_${targetUserId}`,
    subscriptionId: stripeSubscriptionId || `sub_automation_${Date.now()}`,
    priceId: resolvedPriceId,
  }

  const billingState = await BillingService.immediateUpgrade(targetUserId, planKey, stripeData, 'admin')

  return NextResponse.json({
    success: true,
    billing: billingState,
    automation: {
      planKey,
      stripeData,
    },
  })
}
