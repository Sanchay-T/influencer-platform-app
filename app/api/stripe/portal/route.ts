/**
 * ═══════════════════════════════════════════════════════════════
 * STRIPE PORTAL ROUTE - Customer Portal Session
 * ═══════════════════════════════════════════════════════════════
 *
 * Creates a Stripe Customer Portal session for subscription management.
 * Users can update payment methods, view invoices, and cancel subscriptions.
 *
 * Request: { returnUrl?: string }
 * Response: { success: boolean, portalUrl: string, sessionId: string, returnUrl: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { StripeClient } from '@/lib/billing';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.BILLING);

export async function POST(request: NextRequest) {
	try {
		// ─────────────────────────────────────────────────────────────
		// AUTH
		// ─────────────────────────────────────────────────────────────

		const { userId } = await getAuthOrTest();

		if (!userId) {
			logger.warn('Portal request unauthorized');
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// ─────────────────────────────────────────────────────────────
		// PARSE REQUEST
		// ─────────────────────────────────────────────────────────────

		let returnUrl: string;

		try {
			const body = await request.json();
			returnUrl = body.returnUrl || `${process.env.NEXT_PUBLIC_SITE_URL || ''}/billing`;
		} catch {
			returnUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/billing`;
		}

		// ─────────────────────────────────────────────────────────────
		// GET USER & VALIDATE
		// ─────────────────────────────────────────────────────────────

		const user = await getUserProfile(userId);

		if (!user) {
			logger.warn('User not found for portal', { userId });
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		if (!user.stripeCustomerId) {
			logger.warn('No Stripe customer ID for portal', { userId });
			return NextResponse.json(
				{ error: 'No subscription found. Please subscribe first.' },
				{ status: 400 }
			);
		}

		// ─────────────────────────────────────────────────────────────
		// CREATE PORTAL SESSION
		// ─────────────────────────────────────────────────────────────

		logger.info('Creating portal session', {
			userId,
			metadata: { customerId: user.stripeCustomerId },
		});

		const session = await StripeClient.createPortalSession({
			customerId: user.stripeCustomerId,
			returnUrl,
		});

		logger.info('Portal session created', {
			userId,
			metadata: { sessionId: session.id },
		});

		return NextResponse.json({
			success: true,
			portalUrl: session.url,
			sessionId: session.id,
			returnUrl,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Portal session creation failed', error as Error);

		return NextResponse.json(
			{ error: 'Failed to create portal session', details: errorMessage },
			{ status: 500 }
		);
	}
}
