import { type NextRequest, NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin-utils';
import { getAllPlans, PLAN_ORDER } from '@/lib/billing/plan-config';
import { structuredConsole } from '@/lib/logging/console-proxy';

export async function GET() {
	try {
		if (!(await isAdminUser())) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const orderedPlans = getAllPlans().sort(
			(a, b) => PLAN_ORDER.indexOf(a.key) - PLAN_ORDER.indexOf(b.key)
		);

		const plans = orderedPlans.map((plan) => ({
			planKey: plan.key,
			displayName: plan.name,
			description: plan.description,
			campaignsLimit: plan.limits.campaigns,
			creatorsLimit: plan.limits.creatorsPerMonth,
			enrichmentsLimit: plan.limits.enrichmentsPerMonth,
			isActive: true,
			isLegacy: Boolean(plan.isLegacy),
			monthlyPrice: plan.monthlyPrice,
			yearlyPrice: plan.yearlyPrice,
			features: plan.features,
			updatedAt: null,
		}));

		return NextResponse.json({
			plans,
			source: 'static_plan_config',
			readOnly: true,
		});
	} catch (err) {
		structuredConsole.error('[ADMIN-PLANS][GET] error', err);
		return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
	}
}

export async function PUT(_req: NextRequest) {
	try {
		if (!(await isAdminUser())) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		return NextResponse.json(
			{
				error: 'Admin plan mutations are deprecated. Plan limits are read-only from static plan config.',
				source: 'static_plan_config',
			},
			{ status: 409 }
		);
	} catch (err) {
		structuredConsole.error('[ADMIN-PLANS][PUT] error', err);
		return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
	}
}
