import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';

export async function GET() {
	const { userId, sessionClaims } = await getAuthOrTest();
	if (!userId) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	return NextResponse.json({
		ok: true,
		userId,
		email: (sessionClaims as any)?.email ?? null,
		via: 'test-auth-wrapper',
	});
}
