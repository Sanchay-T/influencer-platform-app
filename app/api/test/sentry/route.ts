import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const action = searchParams.get('action') || 'message';

	const timestamp = new Date().toISOString();

	try {
		if (action === 'error') {
			// Throw an actual error to test error capture
			throw new Error(`DEV TEST ERROR at ${timestamp}`);
		}

		if (action === 'message') {
			// Send a test message
			Sentry.captureMessage(`DEV TEST MESSAGE at ${timestamp}`, 'info');
			return NextResponse.json({
				success: true,
				action: 'message',
				timestamp,
				message: 'Sentry message sent - check your dashboard',
			});
		}

		if (action === 'breadcrumb') {
			// Add breadcrumb and send message
			Sentry.addBreadcrumb({
				category: 'test',
				message: 'Test breadcrumb from dev',
				level: 'info',
			});
			Sentry.captureMessage(`DEV TEST with breadcrumb at ${timestamp}`, 'info');
			return NextResponse.json({
				success: true,
				action: 'breadcrumb',
				timestamp,
				message: 'Sentry message with breadcrumb sent',
			});
		}

		return NextResponse.json(
			{
				error: 'Invalid action',
				validActions: ['message', 'error', 'breadcrumb'],
			},
			{ status: 400 }
		);
	} catch (error) {
		// This will be caught by Sentry automatically via instrumentation
		// But we also capture it explicitly
		Sentry.captureException(error);

		return NextResponse.json(
			{
				success: false,
				action: 'error',
				timestamp,
				message: 'Error thrown and captured by Sentry',
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
