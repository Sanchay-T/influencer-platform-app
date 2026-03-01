import { NextResponse } from 'next/server';

// Deprecated: we moved Stripe webhooks to /api/stripe/webhook.
// Keep this route to return a clear 410 (Gone) instead of a 404,
// so old integrations fail loudly and validation tests can assert the intent.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const responseBody = {
	error: 'GONE',
	message: 'Deprecated endpoint. Use /api/stripe/webhook instead.',
};

export async function POST() {
	return NextResponse.json(responseBody, { status: 410 });
}

export async function GET() {
	return NextResponse.json(responseBody, { status: 410 });
}

