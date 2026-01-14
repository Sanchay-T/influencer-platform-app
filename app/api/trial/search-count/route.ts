/**
 * Trial Search Count API
 *
 * Returns the trial search status for the authenticated user.
 * Used by frontend to display remaining searches and lock UI for trial users.
 */

import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getTrialSearchStatus } from '@/lib/billing';

export async function GET() {
	const { userId } = await getAuthOrTest();

	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const status = await getTrialSearchStatus(userId);

	if (!status) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	return NextResponse.json(status);
}
