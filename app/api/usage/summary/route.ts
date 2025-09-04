import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PlanEnforcementService } from '@/lib/services/plan-enforcement';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const usage = await PlanEnforcementService.getCurrentUsage(userId);
    const profile = await db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) });
    const currentPlan = profile?.currentPlan || 'unknown';

    if (!usage) return NextResponse.json({ error: 'Unable to determine usage' }, { status: 500 });

    return NextResponse.json({
      currentPlan,
      campaigns: {
        used: usage.campaignsUsed,
        remaining: usage.campaignsRemaining === Infinity ? null : usage.campaignsRemaining,
        limit: usage.campaignsRemaining === Infinity ? null : usage.campaignsUsed + usage.campaignsRemaining,
      },
      creators: {
        used: usage.creatorsUsed,
        remaining: usage.creatorsRemaining === Infinity ? null : usage.creatorsRemaining,
        limit: usage.creatorsRemaining === Infinity ? null : usage.creatorsUsed + usage.creatorsRemaining,
      }
    });
  } catch (err) {
    console.error('[USAGE-SUMMARY][GET] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

