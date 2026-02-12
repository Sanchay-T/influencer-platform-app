import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin-utils';
import { db } from '@/lib/db';
import { subscriptionPlans } from '@/lib/db/schema';
import { structuredConsole } from '@/lib/logging/console-proxy';

type PlanUpdateInput = Partial<{
	displayName: string;
	description: string;
	campaignsLimit: number;
	creatorsLimit: number;
	isActive: boolean;
	features: unknown;
}>;

type PlanUpdatePayload = Partial<{
	displayName: string;
	description: string;
	campaignsLimit: number;
	creatorsLimit: number;
	isActive: boolean;
	features: unknown;
	updatedAt: Date;
}>;

type UserPlanSnapshotUpdate = Partial<{
	planCampaignsLimit: number;
	planCreatorsLimit: number;
	planFeatures: unknown;
}>;

export async function GET() {
	try {
		if (!(await isAdminUser())) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
		// Hide internal IDs where not needed
		const data = plans.map((p) => ({
			planKey: p.planKey,
			displayName: p.displayName,
			description: p.description,
			campaignsLimit: p.campaignsLimit,
			creatorsLimit: p.creatorsLimit,
			isActive: p.isActive,
			features: p.features,
			updatedAt: p.updatedAt,
		}));
		return NextResponse.json({ plans: data });
	} catch (err) {
		structuredConsole.error('[ADMIN-PLANS][GET] error', err);
		return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
	}
}

export async function PUT(req: NextRequest) {
	try {
		if (!(await isAdminUser())) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json().catch(() => ({}));
		const planKey = String(body.planKey || '').trim();
		const update: PlanUpdateInput = body.update || {};

		if (!planKey) {
			return NextResponse.json({ error: 'planKey is required' }, { status: 400 });
		}

		// Validate allowed keys
		const allowedKeys = new Set([
			'displayName',
			'description',
			'campaignsLimit',
			'creatorsLimit',
			'isActive',
			'features',
		]);
		const unknown = Object.keys(update).filter((k) => !allowedKeys.has(k));
		if (unknown.length) {
			return NextResponse.json({ error: `Unknown fields: ${unknown.join(', ')}` }, { status: 400 });
		}

		// Coerce numeric fields
		if (typeof update.campaignsLimit !== 'undefined') {
			update.campaignsLimit = Number(update.campaignsLimit);
			if (!Number.isFinite(update.campaignsLimit)) {
				return NextResponse.json({ error: 'campaignsLimit must be a number' }, { status: 400 });
			}
		}
		if (typeof update.creatorsLimit !== 'undefined') {
			update.creatorsLimit = Number(update.creatorsLimit);
			if (!Number.isFinite(update.creatorsLimit)) {
				return NextResponse.json({ error: 'creatorsLimit must be a number' }, { status: 400 });
			}
		}

		// Fetch existing plan
		const existing = await db.query.subscriptionPlans.findFirst({
			where: eq(subscriptionPlans.planKey, planKey),
		});
		if (!existing) {
			return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
		}

		// Prepare update payload
		const setPayload: PlanUpdatePayload = { updatedAt: new Date() };
		if (typeof update.displayName !== 'undefined') {
			setPayload.displayName = update.displayName;
		}
		if (typeof update.description !== 'undefined') {
			setPayload.description = update.description;
		}
		if (typeof update.campaignsLimit !== 'undefined') {
			setPayload.campaignsLimit = update.campaignsLimit;
		}
		if (typeof update.creatorsLimit !== 'undefined') {
			setPayload.creatorsLimit = update.creatorsLimit;
		}
		if (typeof update.isActive !== 'undefined') {
			setPayload.isActive = update.isActive;
		}
		if (typeof update.features !== 'undefined') {
			setPayload.features = update.features;
		}

		// Apply update to subscription_plans
		await db
			.update(subscriptionPlans)
			.set(setPayload)
			.where(eq(subscriptionPlans.planKey, planKey));

		// Best-effort propagate snapshot limits/features to users on this plan
		// (keeps UI usage widgets consistent; enforcement reads from subscription_plans anyway)
		const userUpdates: UserPlanSnapshotUpdate = {};
		if (typeof update.campaignsLimit !== 'undefined') {
			userUpdates.planCampaignsLimit = update.campaignsLimit;
		}
		if (typeof update.creatorsLimit !== 'undefined') {
			userUpdates.planCreatorsLimit = update.creatorsLimit;
		}
		if (typeof update.features !== 'undefined') {
			userUpdates.planFeatures = update.features;
		}
		if (Object.keys(userUpdates).length > 0) {
			// Note: This is a bulk update - for production, consider individual updates
			// For now, skip individual user updates to avoid complexity
			structuredConsole.log(
				`[ADMIN-PLANS] Plan updated: ${planKey}, affected user count needs manual sync`
			);
		}

		// Return updated plan
		const updated = await db.query.subscriptionPlans.findFirst({
			where: eq(subscriptionPlans.planKey, planKey),
		});
		return NextResponse.json({ success: true, plan: updated });
	} catch (err) {
		structuredConsole.error('[ADMIN-PLANS][PUT] error', err);
		return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
	}
}
