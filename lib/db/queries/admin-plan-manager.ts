import { db } from '@/lib/db';
import {
  users,
  userSubscriptions,
  userUsage,
  userSystemData,
  userBilling,
  subscriptionPlans,
} from '@/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { getUserProfile, updateUserProfile } from './user-queries';

export type AdminUserSummary = {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  onboardingStep: string;
  currentPlan: string;
  subscriptionStatus: string;
  trialStatus: string;
  subscriptionRenewalDate: Date | null;
  planCampaignsLimit: number | null;
  planCreatorsLimit: number | null;
  createdAt: Date;
};

export async function searchUsersByEmail(query: string, limit = 10): Promise<AdminUserSummary[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const results = await db
    .select({
      id: users.id,
      userId: users.userId,
      email: users.email,
      fullName: users.fullName,
      onboardingStep: users.onboardingStep,
      currentPlan: userSubscriptions.currentPlan,
      subscriptionStatus: userSubscriptions.subscriptionStatus,
      trialStatus: userSubscriptions.trialStatus,
      subscriptionRenewalDate: userSubscriptions.subscriptionRenewalDate,
      planCampaignsLimit: userUsage.planCampaignsLimit,
      planCreatorsLimit: userUsage.planCreatorsLimit,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
    .leftJoin(userUsage, eq(users.id, userUsage.userId))
    .where(ilike(users.email, `%${normalizedQuery}%`))
    .limit(limit);

  return results.map((row) => ({
    ...row,
    currentPlan: row.currentPlan ?? 'free',
    subscriptionStatus: row.subscriptionStatus ?? 'none',
    trialStatus: row.trialStatus ?? 'pending',
  }));
}

type PlanGrantOptions = {
  onboardingStep?: 'pending' | 'completed';
  skipUsageReset?: boolean;
  fakeStripeSubscriptionId?: string;
};

export async function grantPlanToUserByEmail(email: string, planKey: string, options: PlanGrantOptions = {}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  const userRecord = await db.select().from(users).where(ilike(users.email, normalizedEmail)).limit(1);
  if (!userRecord.length) {
    throw new Error(`User not found with email: ${email}`);
  }

  const user = userRecord[0];

  const planRow = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.planKey, planKey) });
  if (!planRow) {
    throw new Error(`Plan not found: ${planKey}`);
  }

  const planFeatures = planRow.features ?? {};

  await db.transaction(async (tx) => {
    const now = new Date();
    const renewalDate = new Date(now.getTime());
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);

    await tx.update(users)
      .set({
        onboardingStep: options.onboardingStep === 'pending' ? 'pending' : 'completed',
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    const subscriptionUpdates = {
      currentPlan: planKey,
      intendedPlan: planKey,
      subscriptionStatus: 'active',
      trialStatus: 'converted',
      trialConversionDate: now,
      subscriptionRenewalDate: renewalDate,
      billingSyncStatus: 'synced',
      updatedAt: now,
    };

    const hasSubscription = await tx.select({ id: userSubscriptions.id })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, user.id));

    if (hasSubscription.length) {
      await tx.update(userSubscriptions)
        .set(subscriptionUpdates)
        .where(eq(userSubscriptions.userId, user.id));
    } else {
      await tx.insert(userSubscriptions).values({
        userId: user.id,
        ...subscriptionUpdates,
      });
    }

    const usageUpdates = {
      planCampaignsLimit: planRow.campaignsLimit ?? -1,
      planCreatorsLimit: planRow.creatorsLimit ?? -1,
      planFeatures,
      updatedAt: now,
    };

    if (!options.skipUsageReset) {
      Object.assign(usageUpdates, {
        usageCampaignsCurrent: 0,
        usageCreatorsCurrentMonth: 0,
        usageResetDate: now,
      });
    }

    const hasUsage = await tx.select({ id: userUsage.id })
      .from(userUsage)
      .where(eq(userUsage.userId, user.id));

    if (hasUsage.length) {
      await tx.update(userUsage)
        .set(usageUpdates)
        .where(eq(userUsage.userId, user.id));
    } else {
      await tx.insert(userUsage).values({
        userId: user.id,
        ...usageUpdates,
      });
    }

    const billingUpdates = {
      stripeCustomerId: options.fakeStripeSubscriptionId ? 'manual_admin_grant' : null,
      stripeSubscriptionId: options.fakeStripeSubscriptionId || null,
      updatedAt: now,
    };

    if (billingUpdates.stripeCustomerId) {
      const hasBilling = await tx.select({ id: userBilling.id })
        .from(userBilling)
        .where(eq(userBilling.userId, user.id));

      if (hasBilling.length) {
        await tx.update(userBilling)
          .set(billingUpdates)
          .where(eq(userBilling.userId, user.id));
      } else {
        await tx.insert(userBilling).values({
          userId: user.id,
          stripeCustomerId: billingUpdates.stripeCustomerId,
          stripeSubscriptionId: billingUpdates.stripeSubscriptionId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await tx.update(userSystemData)
      .set({
        lastWebhookEvent: 'admin_manual_upgrade',
        lastWebhookTimestamp: now,
        updatedAt: now,
      })
      .where(eq(userSystemData.userId, user.id));
  });

  return getUserProfile(user.userId);
}
