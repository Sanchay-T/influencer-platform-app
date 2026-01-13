import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getDashboardOverview } from '@/lib/dashboard/overview';
import { structuredConsole } from '@/lib/logging/console-proxy';

// @performance Vercel timeout protection - dashboard aggregates multiple queries
export const maxDuration = 20;

function errorResponse(error: unknown, status = 500) {
	structuredConsole.error('[DASHBOARD_OVERVIEW_API]', error);
	const message =
		status === 500 ? 'Internal server error' : ((error as Error).message ?? 'Request failed');
	return NextResponse.json({ error: message }, { status });
}

// Surface favorites + recency snapshots to dashboard UI
export async function GET() {
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const data = await getDashboardOverview(userId);

		return NextResponse.json(data);
	} catch (error) {
		if ((error as Error).message === 'USER_NOT_FOUND') {
			return errorResponse('User record not found', 404);
		}
		return errorResponse(error);
	}
}
