import { Receiver } from '@upstash/qstash';

export type QstashSignatureVerificationResult =
	| { ok: true; callbackUrl: string; verified: boolean }
	| { ok: false; callbackUrl: string; status: 401; error: string };

/**
 * Signature verification policy:
 * - production and all non-dev/test environments: always verify (fail closed)
 * - development/test: opt-in via VERIFY_QSTASH_SIGNATURE=true for convenience
 *
 * NOTE: SKIP_QSTASH_SIGNATURE is intentionally ignored in production.
 * The audit flagged that allowing SKIP in production enables request forgery.
 */
export function shouldVerifyQstashSignature(): boolean {
	if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
		return process.env.VERIFY_QSTASH_SIGNATURE === 'true';
	}
	return true;
}

function stripTrailingSlash(value: string): string {
	return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getRequestBaseUrl(req: Request): string {
	const currentHost = req.headers.get('host') || process.env.VERCEL_URL || '';
	const defaultBase = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

	if (!currentHost) {
		return stripTrailingSlash(defaultBase);
	}

	const protocol =
		currentHost.includes('localhost') || currentHost.startsWith('127.') ? 'http' : 'https';
	return `${protocol}://${currentHost}`;
}

export function getQstashCallbackUrl(req: Request, pathname: string): string {
	const baseUrl = stripTrailingSlash(getRequestBaseUrl(req));
	const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
	return `${baseUrl}${normalizedPathname}`;
}

function getQstashReceiver(): Receiver {
	const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
	const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

	if (!(currentSigningKey && nextSigningKey)) {
		throw new Error(
			'QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY must be configured to verify QStash signatures.'
		);
	}

	return new Receiver({
		currentSigningKey,
		nextSigningKey,
	});
}

export async function verifyQstashRequestSignature(params: {
	req: Request;
	rawBody: string;
	pathname: string;
}): Promise<QstashSignatureVerificationResult> {
	const { req, rawBody, pathname } = params;

	const callbackUrl = getQstashCallbackUrl(req, pathname);

	if (!shouldVerifyQstashSignature()) {
		return { ok: true, verified: false, callbackUrl };
	}

	const signature = req.headers.get('Upstash-Signature');
	if (!signature) {
		return { ok: false, status: 401, error: 'Missing signature', callbackUrl };
	}

	try {
		const receiver = getQstashReceiver();
		const valid = await receiver.verify({ signature, body: rawBody, url: callbackUrl });
		if (!valid) {
			return { ok: false, status: 401, error: 'Invalid signature', callbackUrl };
		}
		return { ok: true, verified: true, callbackUrl };
	} catch {
		return { ok: false, status: 401, error: 'Signature verification failed', callbackUrl };
	}
}

