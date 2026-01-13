import { NextResponse } from 'next/server';

const deprecatedResponse = () =>
	NextResponse.json(
		{ error: 'Deprecated endpoint. Use /api/stripe/webhook instead.' },
		{ status: 410 }
	);

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function POST() {
	return deprecatedResponse();
}

// biome-ignore lint/style/useNamingConvention: Next.js route handlers are expected to be exported as uppercase (GET/POST/etc).
export async function GET() {
	return deprecatedResponse();
}
