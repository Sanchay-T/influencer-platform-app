import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { validateCampaignCreation } from '@/lib/billing';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { structuredConsole } from '@/lib/logging/console-proxy';

const logger = createCategoryLogger(LogCategory.BILLING);

export async function GET() {
	try {
		const { userId } = await getAuthOrTest();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const validation = await validateCampaignCreation(userId);
		if (!validation.allowed) {
			return NextResponse.json(
				{
					allowed: false,
					message: validation.reason || 'Campaign limit reached',
				},
				{ status: 200 }
			);
		}

		return NextResponse.json({ allowed: true });
	} catch (err) {
		// Log the error with full context for debugging
		logger.error(
			'Campaign creation validation failed - failing open',
			err instanceof Error ? err : new Error(String(err)),
			{
				errorType: err instanceof Error ? err.constructor.name : typeof err,
				message: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined,
				failureMode: 'fail-open',
				securityNote: 'Failing open allows campaign creation despite validation failure',
			}
		);

		structuredConsole.error('[CAN-CREATE-CAMPAIGN] error', err);
		return NextResponse.json({ allowed: false, message: 'Validation error — please try again' });
	}
}
