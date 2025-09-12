import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PlanValidator } from '@/lib/services/plan-validator';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = await PlanValidator.validateCampaignCreation(userId);
    if (!validation.allowed) {
      return NextResponse.json({
        allowed: false,
        message: validation.reason || 'Campaign limit reached'
      }, { status: 200 });
    }

    return NextResponse.json({ allowed: true });
  } catch (err) {
    console.error('[CAN-CREATE-CAMPAIGN] error', err);
    return NextResponse.json({ allowed: true }); // fail-open to avoid blocking
  }
}
