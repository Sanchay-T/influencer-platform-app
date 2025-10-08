import { updateUserProfile, getUserProfile, createUser } from '@/lib/db/queries/user-queries';

const AUTOMATION_USER_ID = 'user_33neqrnH0OrnbvECgCZF9YT4E7F';

async function seedAutomationProfile() {
  let existing = await getUserProfile(AUTOMATION_USER_ID).catch(() => null);

  if (!existing) {
    existing = await createUser({
      userId: AUTOMATION_USER_ID,
      email: 'test-automation@gemz.io',
      fullName: 'Automation Tester',
      businessName: 'Automation QA Labs',
      onboardingStep: 'pending',
      currentPlan: 'free',
    });
  }

  const now = new Date();
  const trialStart = existing?.trialStartDate ?? now;
  const trialEnd = existing?.trialEndDate ?? new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  await updateUserProfile(AUTOMATION_USER_ID, {
    fullName: 'Automation Tester',
    businessName: 'Automation QA Labs',
    brandDescription: 'Automated QA brand focused on verifying billing and plan gating.',
    onboardingStep: 'completed',
    intendedPlan: 'glow_up',
    currentPlan: 'glow_up',
    subscriptionStatus: 'trialing',
    trialStatus: 'active',
    trialStartDate: trialStart,
    trialEndDate: trialEnd,
    planCampaignsLimit: 3,
    planCreatorsLimit: 1000,
    usageCampaignsCurrent: 0,
    usageCreatorsCurrentMonth: 0,
    stripeCustomerId: 'cus_automation',
    stripeSubscriptionId: 'sub_automation',
  });

  console.log('Automation user onboarding fields seeded successfully.');
}

seedAutomationProfile()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed automation user:', error);
    process.exit(1);
  });
