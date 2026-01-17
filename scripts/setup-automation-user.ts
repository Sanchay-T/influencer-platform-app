#!/usr/bin/env tsx
/**
 * Setup automation test user with an active plan
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '../lib/db';
import { users, userSubscriptions, userBilling, userUsage } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const clerkUserId = 'user_33neqrnH0OrnbvECgCZF9YT4E7F';

  console.log(`Setting up automation user: ${clerkUserId}`);

  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.userId, clerkUserId),
    with: { subscription: true }
  });

  if (!user) {
    console.log('User not found, creating...');
    const [newUser] = await db.insert(users).values({
      userId: clerkUserId,
      email: 'test-automation@gemz.io',
      fullName: 'Automation Test',
      businessName: 'Test Business',
      onboardingStep: 'completed',
    }).returning();

    await db.insert(userSubscriptions).values({
      userId: newUser.id,
      currentPlan: 'fame_flex',
      subscriptionStatus: 'active',
    });

    await db.insert(userBilling).values({
      userId: newUser.id,
      stripeCustomerId: null,
    }).onConflictDoNothing();

    await db.insert(userUsage).values({
      userId: newUser.id,
      usageCampaignsCurrent: 0,
      usageCreatorsCurrentMonth: 0,
      usageResetDate: new Date(),
    }).onConflictDoNothing();

    console.log(`✅ User created with fame_flex plan: ${newUser.id}`);
  } else {
    console.log(`User found: ${user.id}`);
    console.log(`Current subscription:`, user.subscription);

    if (!user.subscription || user.subscription.subscriptionStatus !== 'active') {
      await db.update(userSubscriptions)
        .set({ currentPlan: 'fame_flex', subscriptionStatus: 'active' })
        .where(eq(userSubscriptions.userId, user.id));
      console.log('✅ Updated to active fame_flex plan');
    } else {
      console.log('✅ User already has active plan');
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
