import { NextResponse } from 'next/server';
import { structuredConsole } from '@/lib/logging/console-proxy';

export async function GET(req: Request) {
	structuredConsole.log('\n🧪 [TEST] QStash connectivity test endpoint called');
	structuredConsole.log('📅 [TEST] Timestamp:', new Date().toISOString());
	structuredConsole.log('🌐 [TEST] Request URL:', req.url);
	structuredConsole.log('📋 [TEST] Request headers:', Object.fromEntries(req.headers.entries()));

	return NextResponse.json({
		success: true,
		message: 'QStash connectivity test successful',
		timestamp: new Date().toISOString(),
		url: req.url,
		headers: Object.fromEntries(req.headers.entries()),
	});
}

export async function POST(req: Request) {
	structuredConsole.log('\n🧪 [TEST] QStash POST test endpoint called');
	structuredConsole.log('📅 [TEST] Timestamp:', new Date().toISOString());
	structuredConsole.log('🌐 [TEST] Request URL:', req.url);

	const body = await req.text();
	structuredConsole.log('📦 [TEST] Request body:', body);

	return NextResponse.json({
		success: true,
		message: 'QStash POST test successful',
		timestamp: new Date().toISOString(),
		receivedBody: body,
	});
}
