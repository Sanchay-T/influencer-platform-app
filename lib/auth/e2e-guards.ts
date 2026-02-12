import { NextResponse } from 'next/server';

export function isE2eApiEnabled(): boolean {
	// These routes are test-only. We hard-disable them in production regardless of flags.
	if (process.env.NODE_ENV === 'production') return false;

	return process.env.NODE_ENV === 'development' || process.env.ENABLE_AUTH_BYPASS === 'true';
}

export function getE2eApiDisabledResponse(): NextResponse {
	const isProd = process.env.NODE_ENV === 'production';
	return NextResponse.json(
		{ error: isProd ? 'Not found' : 'E2E endpoints only available in development' },
		{ status: isProd ? 404 : 403 }
	);
}

