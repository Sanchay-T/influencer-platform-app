import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { PlanValidator } from '@/lib/services/plan-validator';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.BILLING);

export async function GET() {
  try {
    const { userId } = await getAuthOrTest();
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
    // Log the error with full context for debugging
    logger.error('Campaign creation validation failed - failing open', err instanceof Error ? err : new Error(String(err)), {
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      failureMode: 'fail-open',
      securityNote: 'Failing open allows campaign creation despite validation failure'
    });

    console.error('[CAN-CREATE-CAMPAIGN] error', err);
    return NextResponse.json({ allowed: true }); // fail-open to avoid blocking
  }
}
