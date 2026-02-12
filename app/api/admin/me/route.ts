/**
 * Admin Me API
 *
 * @context Used by client UI to determine whether to show admin navigation.
 * Must not leak the admin email allowlist to the browser.
 */

import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin-utils';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';

export async function GET() {
	const { userId } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ isAdmin: false }, { status: 401 });
	}

	const isAdmin = await isAdminUser();
	return NextResponse.json({ isAdmin });
}

