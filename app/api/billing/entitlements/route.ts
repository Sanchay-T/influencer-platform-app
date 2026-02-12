import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getBillingEntitlements } from '@/lib/billing/entitlements';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.BILLING);

const CACHE_TTL_SECONDS = 15;

export async function GET() {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const entitlements = await getBillingEntitlements(userId);

		return NextResponse.json(entitlements, {
			headers: {
				'Cache-Control': `private, max-age=${CACHE_TTL_SECONDS}`,
			},
		});
	} catch (error) {
		logger.error(
			'Failed to resolve billing entitlements',
			error instanceof Error ? error : new Error(String(error))
		);
		return NextResponse.json({ error: 'Failed to resolve entitlements' }, { status: 500 });
	}
}
