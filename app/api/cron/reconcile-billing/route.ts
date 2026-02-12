import { NextResponse } from 'next/server';
import { reconcileStaleBillingState } from '@/lib/billing';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.BILLING);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
	if (process.env.NODE_ENV !== 'production') {
		return true;
	}
	const authHeader = request.headers.get('authorization');
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) {
		return false;
	}
	return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const limitParam = new URL(request.url).searchParams.get('limit');
		const staleMinutesParam = new URL(request.url).searchParams.get('staleMinutes');
		const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
		const staleMinutes = staleMinutesParam
			? Number.parseInt(staleMinutesParam, 10)
			: undefined;

		const result = await reconcileStaleBillingState({
			limit: Number.isFinite(limit ?? NaN) ? limit : undefined,
			staleMinutes: Number.isFinite(staleMinutes ?? NaN) ? staleMinutes : undefined,
		});

		return NextResponse.json({
			success: true,
			...result,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		logger.error(
			'Billing reconciliation cron failed',
			error instanceof Error ? error : new Error(String(error))
		);
		return NextResponse.json({ error: 'Failed to reconcile billing' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	return GET(request);
}
