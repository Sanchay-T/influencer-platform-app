import { type NextRequest, NextResponse } from 'next/server';
import { createCategoryLogger, LogCategory } from '@/lib/logging';

const onboardingLogger = createCategoryLogger(LogCategory.BILLING);

// In-memory log buffer for development/debugging (cleared on serverless cold start)
// Note: In production serverless, this won't persist across invocations - use a logging service for persistence
const logBuffer: string[] = [];
const MAX_LOG_LINES = 500;

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const timestamp = new Date().toISOString();
		const line = `[${timestamp.replace('T', ' ').replace('Z', '')}] [${body?.step ?? 'UNKNOWN'}] [${body?.action ?? 'UNKNOWN'}] - ${body?.description ?? ''}`;

		// Add to in-memory buffer
		logBuffer.push(line);
		if (logBuffer.length > MAX_LOG_LINES) {
			logBuffer.shift(); // Remove oldest entry
		}

		// Also log to structured logging system
		onboardingLogger.info('Onboarding event', {
			metadata: {
				step: body?.step,
				action: body?.action,
				description: body?.description,
			},
		});

		return NextResponse.json({ success: true });
	} catch (e) {
		return NextResponse.json({ error: 'Failed to write log' }, { status: 500 });
	}
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const linesParam = Number(searchParams.get('lines') || 50);
		return NextResponse.json({ lines: logBuffer.slice(-linesParam) });
	} catch (e) {
		return NextResponse.json({ error: 'Failed to read log' }, { status: 500 });
	}
}

export async function DELETE() {
	try {
		logBuffer.length = 0; // Clear in-memory buffer
		return NextResponse.json({ success: true });
	} catch (e) {
		return NextResponse.json({ error: 'Failed to clear log' }, { status: 500 });
	}
}
