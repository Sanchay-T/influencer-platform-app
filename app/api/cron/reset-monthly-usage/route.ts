/**
 * ═══════════════════════════════════════════════════════════════
 * CRON: Reset Monthly Usage
 * ═══════════════════════════════════════════════════════════════
 *
 * This endpoint is called by Vercel Cron on the 1st of each month
 * to reset the `usageCreatorsCurrentMonth` for all users.
 *
 * Security: Vercel cron jobs include an Authorization header
 * with CRON_SECRET for verification.
 */

import { NextResponse } from 'next/server';
import { resetAllMonthlyUsage } from '@/lib/billing';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.SYSTEM);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET handler for Vercel Cron.
 * Vercel cron uses GET requests.
 */
export async function GET(request: Request) {
	try {
		// Verify this is a legitimate cron request
		const authHeader = request.headers.get('authorization');
		const cronSecret = process.env.CRON_SECRET;

		// In production, verify the cron secret
		if (process.env.NODE_ENV === 'production') {
			if (!cronSecret) {
				logger.error('CRON_SECRET not configured');
				return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
			}

			if (authHeader !== `Bearer ${cronSecret}`) {
				logger.warn('Unauthorized cron request attempted');
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}
		}

		logger.info('Starting monthly usage reset');
		const startTime = Date.now();

		const usersReset = await resetAllMonthlyUsage();

		const duration = Date.now() - startTime;
		logger.info('Monthly usage reset completed', { usersReset, durationMs: duration });

		return NextResponse.json({
			success: true,
			usersReset,
			durationMs: duration,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		const normalizedError = error instanceof Error ? error : new Error(String(error));
		logger.error('Monthly usage reset failed', normalizedError);
		return NextResponse.json(
			{
				error: 'Failed to reset usage',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}

/**
 * POST handler for manual trigger (e.g., admin panel).
 */
export async function POST(request: Request) {
	// Same logic as GET, just different method for manual triggers
	return GET(request);
}
