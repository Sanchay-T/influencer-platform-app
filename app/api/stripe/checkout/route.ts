/**
 * ═══════════════════════════════════════════════════════════════
 * STRIPE CHECKOUT ROUTE - Unified Checkout Session Creation
 * ═══════════════════════════════════════════════════════════════
 *
 * Creates Stripe Checkout Sessions for:
 * - Onboarding (new users selecting a plan)
 * - Upgrades (existing users changing plans)
 *
 * Request: { planId: PlanKey, billing: 'monthly' | 'yearly' }
 * Response: { url: string } | { url: string, price: PriceInfo, isUpgrade: true }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { type BillingInterval, CheckoutService, isValidPlan, type PlanKey } from '@/lib/billing';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.BILLING);

export async function POST(request: NextRequest) {
	const startTime = Date.now();

	try {
		// ─────────────────────────────────────────────────────────────
		// AUTH
		// ─────────────────────────────────────────────────────────────

		const { userId } = await getAuthOrTest();

		if (!userId) {
			logger.warn('Checkout request unauthorized');
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// ─────────────────────────────────────────────────────────────
		// PARSE & VALIDATE REQUEST
		// ─────────────────────────────────────────────────────────────

		const body = await request.json();
		const { planId, billing = 'monthly' } = body as {
			planId?: string;
			billing?: string;
		};

		if (!planId) {
			return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
		}

		if (!isValidPlan(planId)) {
			return NextResponse.json(
				{ error: `Invalid plan: ${planId}. Valid plans: glow_up, viral_surge, fame_flex` },
				{ status: 400 }
			);
		}

		const interval = billing === 'yearly' ? 'yearly' : 'monthly';

		logger.info('Creating checkout session', {
			userId,
			metadata: { planId, interval },
		});

		// ─────────────────────────────────────────────────────────────
		// GET USER PROFILE
		// ─────────────────────────────────────────────────────────────

		const user = await getUserProfile(userId);

		if (!user) {
			logger.warn('User not found for checkout', { userId });
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// ─────────────────────────────────────────────────────────────
		// CREATE CHECKOUT SESSION
		// ─────────────────────────────────────────────────────────────

		const result = await CheckoutService.createCheckout({
			userId,
			email: user.email || '',
			plan: planId as PlanKey,
			interval: interval as BillingInterval,
		});

		const duration = Date.now() - startTime;
		logger.info('Checkout session created', {
			userId,
			metadata: {
				sessionId: result.sessionId,
				planId,
				interval,
				isUpgrade: 'isUpgrade' in result,
				durationMs: duration,
			},
		});

		return NextResponse.json(result);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Checkout session creation failed', error as Error);

		return NextResponse.json(
			{ error: 'Failed to create checkout session', details: errorMessage },
			{ status: 500 }
		);
	}
}
