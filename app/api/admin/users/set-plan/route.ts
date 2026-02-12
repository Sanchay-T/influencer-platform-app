import { type NextRequest, NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin-utils';
import { getPlanConfig, isValidPlan } from '@/lib/billing/plan-config';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { structuredConsole } from '@/lib/logging/console-proxy';

export async function POST(req: NextRequest) {
	try {
		if (!(await isAdminUser())) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json().catch(() => ({}));
		const userId = String(body.userId || '').trim();
		const planKey = String(body.planKey || '').trim();

		if (!(userId && planKey)) {
			return NextResponse.json({ error: 'userId and planKey are required' }, { status: 400 });
		}

		if (!isValidPlan(planKey)) {
			return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
		}
		const plan = getPlanConfig(planKey);

		// Update user's plan and snapshot limits
		await updateUserProfile(userId, {
			currentPlan: plan.key,
			planCampaignsLimit: plan.limits.campaigns,
			planCreatorsLimit: plan.limits.creatorsPerMonth,
			planFeatures: plan.features,
		});

		const updated = await getUserProfile(userId);
		return NextResponse.json({ success: true, user: updated });
	} catch (err) {
		structuredConsole.error('[ADMIN-SET-PLAN] error', err);
		return NextResponse.json({ error: 'Failed to set user plan' }, { status: 500 });
	}
}
