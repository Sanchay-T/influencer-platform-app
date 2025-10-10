import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/backend-auth';
import { PlanValidator } from '@/lib/services/plan-validator';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const planStatus = await PlanValidator.getUserPlanStatus(userId);
    if (!planStatus) return NextResponse.json({ error: 'Unable to determine usage' }, { status: 500 });

    return NextResponse.json({
      currentPlan: planStatus.currentPlan,
      campaigns: {
        used: planStatus.campaignsUsed,
        remaining: planStatus.campaignsRemaining === -1 ? null : planStatus.campaignsRemaining,
        limit: planStatus.planConfig.campaignsLimit === -1 ? null : planStatus.planConfig.campaignsLimit,
      },
      creators: {
        used: planStatus.creatorsUsed,
        remaining: planStatus.creatorsRemaining === -1 ? null : planStatus.creatorsRemaining,
        limit: planStatus.planConfig.creatorsLimit === -1 ? null : planStatus.planConfig.creatorsLimit,
      }
    });
  } catch (err) {
    console.error('[USAGE-SUMMARY][GET] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
