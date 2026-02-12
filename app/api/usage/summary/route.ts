import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUsageSummary } from '@/lib/billing';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const logger = createCategoryLogger(LogCategory.BILLING);

export async function GET() {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const summary = await getUsageSummary(userId);

		if (!summary) {
			return NextResponse.json(
				{
					currentPlan: null,
					campaigns: { used: 0, limit: 0, remaining: 0, isUnlimited: false, percentUsed: 0 },
					creatorsThisMonth: {
						used: 0,
						limit: 0,
						remaining: 0,
						isUnlimited: false,
						percentUsed: 0,
					},
					enrichmentsThisMonth: {
						used: 0,
						limit: 0,
						remaining: 0,
						isUnlimited: false,
						percentUsed: 0,
					},
					lastResetDate: null,
				},
				{
					headers: { 'Cache-Control': 'no-store' },
				}
			);
		}

		return NextResponse.json(summary, {
			headers: { 'Cache-Control': 'no-store' },
		});
	} catch (error) {
		logger.error(
			'Failed to fetch usage summary',
			error instanceof Error ? error : new Error(String(error))
		);
		return NextResponse.json({ error: 'Failed to fetch usage summary' }, { status: 500 });
	}
}
