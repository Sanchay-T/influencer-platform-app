import { type NextRequest, NextResponse } from 'next/server';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { isString, toError } from '@/lib/utils/type-guards';

// DEV-ONLY: Exchanges a Clerk Admin session for a browser-compatible __session cookie
// Guarded by SESSION_EXCHANGE_KEY. No route changes elsewhere; this simply sets a real session cookie.

export async function POST(req: NextRequest) {
	try {
		if (process.env.NODE_ENV === 'production') {
			return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
		}

		const keyHeader = req.headers.get('x-session-exchange-key') || '';
		const expected = process.env.SESSION_EXCHANGE_KEY || '';
		if (!expected || keyHeader !== expected) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const clerkKey = process.env.CLERK_SECRET_KEY;
		if (!clerkKey) return NextResponse.json({ error: 'CLERK_SECRET_KEY not set' }, { status: 500 });

		const { userId, email, createIfMissing = true } = await req.json().catch(() => ({}));
		const targetEmail: string | undefined = email || (userId ? undefined : 'agent+dev@example.com');

		const adminHeaders: HeadersInit = {
			Authorization: `Bearer ${clerkKey}`,
			'Content-Type': 'application/json',
		};

		const clerkApiBase = clerkKey.startsWith('sk_live')
			? 'https://api.clerk.com'
			: 'https://api.clerk.dev';

		// Resolve or create user
		let resolvedUserId: string | undefined = userId;
		if (!resolvedUserId) {
			if (!targetEmail)
				return NextResponse.json({ error: 'Provide userId or email' }, { status: 400 });
			const listRes = await fetch(
				`${clerkApiBase}/v1/users?email_address=` + encodeURIComponent(targetEmail),
				{ headers: adminHeaders }
			);
			const list = await listRes.json();
			resolvedUserId = list?.[0]?.id;
			if (!resolvedUserId && createIfMissing) {
				const createRes = await fetch(`${clerkApiBase}/v1/users`, {
					method: 'POST',
					headers: adminHeaders,
					body: JSON.stringify({ email_address: [targetEmail] }),
				});
				const created = await createRes.json();
				resolvedUserId = created?.id;
			}
			if (!resolvedUserId)
				return NextResponse.json({ error: 'User not found and not created' }, { status: 404 });
		}

		// Create a session for this user
		const sessRes = await fetch(`${clerkApiBase}/v1/sessions`, {
			method: 'POST',
			headers: adminHeaders,
			body: JSON.stringify({ user_id: resolvedUserId }),
		});
		const session = await sessRes.json();
		if (!sessRes.ok) {
			return NextResponse.json(
				{ error: 'Failed to create session', detail: session },
				{ status: sessRes.status }
			);
		}

		// Mint a session token (JWT)
		const tokRes = await fetch(`${clerkApiBase}/v1/sessions/${session.id}/tokens`, {
			method: 'POST',
			headers: adminHeaders,
			body: JSON.stringify({}),
		});
		const token = await tokRes.json();
		const jwt = isString(token?.jwt) ? token.jwt : null;
		if (!(tokRes.ok && jwt)) {
			return NextResponse.json(
				{ error: 'Failed to mint session token', detail: token },
				{ status: 500 }
			);
		}

		// Build cookie
		const requestProtocol = req.nextUrl.protocol || 'https:';
		const host = req.headers.get('host') || '';
		const isLocalHost = host.startsWith('127.0.0.1') || host.startsWith('localhost');
		const secure =
			!isLocalHost &&
			(requestProtocol === 'https:' ||
				(process.env.NEXT_PUBLIC_SITE_URL || '').startsWith('https://'));
		const cookieParts = [
			`__session=${jwt}`,
			'Path=/',
			'HttpOnly',
			'SameSite=None',
			secure ? 'Secure' : '',
			// Optional: limit lifetime to 1 hour (Clerk will validate anyway)
			'Max-Age=3600',
		].filter(Boolean);

		let devBrowserToken: string | undefined;
		try {
			const devBrowserRes = await fetch(`${clerkApiBase}/v1/dev_browser`, {
				method: 'POST',
				headers: adminHeaders,
				body: JSON.stringify({}),
			});
			if (devBrowserRes.ok) {
				const payload = await devBrowserRes.json().catch(() => null);
				if (isString(payload?.token)) devBrowserToken = payload.token;
			} else {
				const detail = await devBrowserRes.text().catch(() => '');
				structuredConsole.warn(
					'[SESSION-EXCHANGE] dev_browser request failed',
					devBrowserRes.status,
					detail
				);
			}
		} catch (err) {
			structuredConsole.warn('[SESSION-EXCHANGE] dev_browser request error', err);
		}

		const devBrowserCookie = devBrowserToken
			? [
					`__clerk_db_jwt=${devBrowserToken}`,
					'Path=/',
					'SameSite=None',
					secure ? 'Secure' : '',
				].filter(Boolean)
			: null;

		const clientUatValue = Math.floor(Date.now() / 1000);
		const clientUatCookie = [
			`__client_uat=${clientUatValue}`,
			'Path=/',
			'SameSite=None',
			secure ? 'Secure' : '',
		].filter(Boolean);

		const response = NextResponse.json({
			success: true,
			userId: resolvedUserId,
			sessionId: session.id,
			cookies: {
				session: `__session=${jwt}`,
				devBrowser: devBrowserToken ? `__clerk_db_jwt=${devBrowserToken}` : undefined,
				clientUat: `__client_uat=${clientUatValue}`,
			},
			note: 'Include these cookies on subsequent requests to authenticate.',
		});

		response.headers.set('Cache-Control', 'no-store');
		response.headers.append('Set-Cookie', cookieParts.join('; '));
		if (devBrowserCookie) {
			response.headers.append('Set-Cookie', devBrowserCookie.join('; '));
		}
		response.headers.append('Set-Cookie', clientUatCookie.join('; '));

		return response;
	} catch (err: unknown) {
		const error = toError(err);
		return NextResponse.json(
			{ error: 'Session exchange failed', detail: error.message },
			{ status: 500 }
		);
	}
}
