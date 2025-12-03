import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, userSubscriptions, userBilling, userUsage, campaigns, scrapingJobs, creatorLists } from '@/lib/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

/**
 * TEMPORARY STRESS TEST - SIMULATES SIGNUP FLOW
 * This makes the SAME queries that happen during user signup:
 * 1. getUserProfile (5-table join)
 * 2. getDashboardOverview queries (favorites, lists, telemetry)
 * 3. BillingService cache miss query
 *
 * DELETE THIS FILE AFTER TESTING
 */
export async function GET() {
  const startTime = Date.now();
  const results: Record<string, any> = {};

  try {
    // ========================================
    // SIMULATE: getUserProfile (from webhook/billing)
    // This is a 4-table JOIN - the heaviest query
    // ========================================
    const profileStart = Date.now();
    const userProfile = await db
      .select({
        id: users.id,
        userId: users.userId,
        email: users.email,
        fullName: users.fullName,
        businessName: users.businessName,
        onboardingStep: users.onboardingStep,
        currentPlan: userSubscriptions.currentPlan,
        trialStatus: userSubscriptions.trialStatus,
        trialStartDate: userSubscriptions.trialStartDate,
        trialEndDate: userSubscriptions.trialEndDate,
        subscriptionStatus: userSubscriptions.subscriptionStatus,
        stripeCustomerId: userBilling.stripeCustomerId,
        stripeSubscriptionId: userBilling.stripeSubscriptionId,
        usageCampaignsCurrent: userUsage.usageCampaignsCurrent,
        usageCreatorsCurrentMonth: userUsage.usageCreatorsCurrentMonth,
        planCampaignsLimit: userUsage.planCampaignsLimit,
        planCreatorsLimit: userUsage.planCreatorsLimit,
      })
      .from(users)
      .leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
      .leftJoin(userBilling, eq(users.id, userBilling.userId))
      .leftJoin(userUsage, eq(users.id, userUsage.userId))
      .limit(1);
    results.getUserProfile = { duration: Date.now() - profileStart, found: userProfile.length };

    // ========================================
    // SIMULATE: getDashboardOverview - getFavoriteInfluencers
    // ========================================
    const favStart = Date.now();
    const favorites = await db
      .select({
        id: creatorLists.id,
        name: creatorLists.name,
      })
      .from(creatorLists)
      .limit(10);
    results.getFavorites = { duration: Date.now() - favStart, found: favorites.length };

    // ========================================
    // SIMULATE: getDashboardOverview - getListsForUser
    // ========================================
    const listsStart = Date.now();
    const lists = await db
      .select({
        id: creatorLists.id,
        name: creatorLists.name,
        createdAt: creatorLists.createdAt,
      })
      .from(creatorLists)
      .orderBy(desc(creatorLists.updatedAt))
      .limit(5);
    results.getLists = { duration: Date.now() - listsStart, found: lists.length };

    // ========================================
    // SIMULATE: getDashboardOverview - getSearchTelemetry
    // ========================================
    const telemetryStart = Date.now();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const telemetry = await db
      .select({
        id: scrapingJobs.id,
        status: scrapingJobs.status,
        createdAt: scrapingJobs.createdAt,
      })
      .from(scrapingJobs)
      .where(gte(scrapingJobs.createdAt, thirtyDaysAgo))
      .limit(100);
    results.getTelemetry = { duration: Date.now() - telemetryStart, found: telemetry.length };

    // ========================================
    // SIMULATE: PlanValidator.getUserPlanStatus
    // Another profile lookup (would normally be cached)
    // ========================================
    const planStart = Date.now();
    const planStatus = await db
      .select({
        currentPlan: userSubscriptions.currentPlan,
        trialStatus: userSubscriptions.trialStatus,
        subscriptionStatus: userSubscriptions.subscriptionStatus,
      })
      .from(userSubscriptions)
      .limit(1);
    results.getPlanStatus = { duration: Date.now() - planStart, found: planStatus.length };

    // ========================================
    // SIMULATE: Campaign count for usage
    // ========================================
    const campaignStart = Date.now();
    const campaignCount = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .limit(100);
    results.getCampaigns = { duration: Date.now() - campaignStart, found: campaignCount.length };

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      total_duration_ms: totalDuration,
      queries: results,
      timestamp: new Date().toISOString(),
      note: 'This simulates 6 DB queries that happen during signup'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration_ms: duration,
      partial_results: results,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
