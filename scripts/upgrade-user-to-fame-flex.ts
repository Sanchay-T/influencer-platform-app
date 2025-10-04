#!/usr/bin/env tsx

import '../lib/config/load-env';
import { grantPlanToUserByEmail } from '../lib/db/queries/admin-plan-manager';
import { getUserProfile } from '../lib/db/queries/user-queries';

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (const token of argv) {
    if (token.startsWith('--')) {
      const [key, value] = token.slice(2).split('=');
      if (value === undefined) {
        args[key] = true;
      } else {
        args[key] = value;
      }
    } else {
      positional.push(token);
    }
  }

  return { args, positional };
}

async function main() {
  const { args, positional } = parseArgs(process.argv.slice(2));

  const email = (args.email as string) || positional[0];
  if (!email) {
    console.error('❌ Please provide an email address. Example:');
    console.error('   npm exec tsx scripts/upgrade-user-to-fame-flex.ts --email user@example.com [--plan fame_flex]');
    process.exit(1);
  }

  const planKey = (args.plan as string) || 'fame_flex';
  const onboardingStep = args['keep-onboarding'] ? 'pending' : 'completed';
  const skipUsageReset = Boolean(args['skip-usage-reset']);
  const fakeStripe = args['no-stripe'] ? undefined : `manual_${planKey}`;

  console.log('🚀 [ADMIN-GRANT-PLAN] Applying plan', { email, planKey, onboardingStep, skipUsageReset });

  try {
    const profile = await grantPlanToUserByEmail(email, planKey, {
      onboardingStep,
      skipUsageReset,
      fakeStripeSubscriptionId: fakeStripe,
    });

    if (!profile) {
      throw new Error('Grant plan returned null profile');
    }

    const updated = await getUserProfile(profile.userId);

    console.log('✅ [ADMIN-GRANT-PLAN] Success!');
    console.table({
      email: updated?.email,
      plan: updated?.currentPlan,
      subscriptionStatus: updated?.subscriptionStatus,
      trialStatus: updated?.trialStatus,
      onboardingStep: updated?.onboardingStep,
      campaignLimit: updated?.planCampaignsLimit,
      renewal: updated?.subscriptionRenewalDate?.toISOString?.() ?? updated?.subscriptionRenewalDate,
    });
  } catch (error) {
    console.error('❌ [ADMIN-GRANT-PLAN] Failed to grant plan:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
