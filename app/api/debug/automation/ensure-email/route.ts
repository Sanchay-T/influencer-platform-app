import { NextResponse } from 'next/server';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile, updateUserProfile } from '@/lib/db/queries/user-queries';
import { getUserEmailFromClerk } from '@/lib/email/email-service';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { getArrayProperty, getStringProperty, toRecord } from '@/lib/utils/type-guards';

export async function POST(request: Request) {
	try {
		if (process.env.NODE_ENV === 'production') {
			return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
		}

		const { userId: bodyUserId, email: bodyEmail } = await request.json().catch(() => ({}));
		const { userId: authUserId } = await getAuthOrTest();

		const targetUserId = bodyUserId || authUserId;
		if (!targetUserId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const profile = await getUserProfile(targetUserId);
		if (!profile) {
			return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
		}

		let email: string | null | undefined = bodyEmail
			? String(bodyEmail).trim().toLowerCase()
			: null;
		if (!email) {
			email = await getUserEmailFromClerk(targetUserId);
		}

		if (!email) {
			return NextResponse.json({ error: 'Primary email not available in Clerk' }, { status: 409 });
		}

		await ensureEmailInClerk(targetUserId, email);

		if (profile.email === email) {
			return NextResponse.json({ success: true, email, updated: false });
		}

		await updateUserProfile(targetUserId, { email });
		return NextResponse.json({ success: true, email, updated: true });
	} catch (error: unknown) {
		structuredConsole.error('[ENSURE-EMAIL] Failed to ensure email', error);
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ error: 'Failed to ensure email', detail: message }, { status: 500 });
	}
}

async function ensureEmailInClerk(userId: string, email: string) {
	const secret = process.env.CLERK_SECRET_KEY;
	if (!secret) throw new Error('CLERK_SECRET_KEY is not configured');

	const apiBase = secret.startsWith('sk_live') ? 'https://api.clerk.com' : 'https://api.clerk.dev';
	const headers = {
		Authorization: `Bearer ${secret}`,
		'Content-Type': 'application/json',
	};

	const userRes = await fetch(`${apiBase}/v1/users/${userId}`, { headers });
	if (!userRes.ok) {
		throw new Error(`Failed to load Clerk user (${userRes.status})`);
	}
	const user = await userRes.json();
	const userRecord = toRecord(user);
	if (!userRecord) {
		throw new Error('Invalid Clerk user payload');
	}

	const emailAddresses = getArrayProperty(userRecord, 'email_addresses') ?? [];
	let primary = emailAddresses
		.map((entry) => toRecord(entry))
		.find((entry) => {
			const address = entry ? getStringProperty(entry, 'email_address') : null;
			return address?.toLowerCase() === email;
		});

	if (!primary) {
		const createRes = await fetch(`${apiBase}/v1/users/${userId}/email_addresses`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ email_address: email }),
		});
		if (!createRes.ok) {
			throw new Error(`Failed to create email address in Clerk (${createRes.status})`);
		}
		primary = toRecord(await createRes.json());
	}

	const primaryId = primary ? getStringProperty(primary, 'id') : null;
	const currentPrimaryId = getStringProperty(userRecord, 'primary_email_address_id');
	if (primaryId && currentPrimaryId !== primaryId) {
		const patchRes = await fetch(`${apiBase}/v1/users/${userId}`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify({ primary_email_address_id: primaryId }),
		});
		if (!patchRes.ok) {
			throw new Error(`Failed to set primary email in Clerk (${patchRes.status})`);
		}
	}
}
