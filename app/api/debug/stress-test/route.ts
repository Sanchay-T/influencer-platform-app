import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, userSubscriptions, userBilling, userUsage } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * TEMPORARY STRESS TEST ENDPOINT
 * Simulates the same DB queries as /api/billing/status
 * DELETE THIS FILE AFTER TESTING
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Simulate the getUserProfile query - same JOIN as billing/status uses
    const result = await db
      .select({
        id: users.id,
        userId: users.userId,
        email: users.email,
        fullName: users.fullName,
        currentPlan: userSubscriptions.currentPlan,
        trialStatus: userSubscriptions.trialStatus,
        stripeCustomerId: userBilling.stripeCustomerId,
        usageCampaignsCurrent: userUsage.usageCampaignsCurrent,
      })
      .from(users)
      .leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
      .leftJoin(userBilling, eq(users.id, userBilling.userId))
      .leftJoin(userUsage, eq(users.id, userUsage.userId))
      .limit(1);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      found_users: result.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
