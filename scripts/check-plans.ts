import { db } from '../lib/db';
import { subscriptionPlans } from '../lib/db/schema';
import { asc } from 'drizzle-orm';

async function main() {
  const plans = await db.select({
    plan_key: subscriptionPlans.planKey,
    display_name: subscriptionPlans.displayName,
    monthly_price: subscriptionPlans.monthlyPrice,
    creators_limit: subscriptionPlans.creatorsLimit,
    stripe_monthly_price_id: subscriptionPlans.stripeMonthlyPriceId,
    stripe_yearly_price_id: subscriptionPlans.stripeYearlyPriceId,
  }).from(subscriptionPlans).orderBy(asc(subscriptionPlans.sortOrder));

  console.table(plans);
  process.exit(0);
}

main().catch(console.error);
