import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

export async function GET() {
	try {
		// Test different types of Sentry integrations

		// 1. Log a message
		logger.info('API endpoint accessed', { endpoint: '/api/test-sentry', method: 'GET' });

		// 2. Send a test message
		Sentry.captureMessage('API test message from /api/test-sentry', 'info');

		// 3. Performance tracking
		return await Sentry.startSpan(
			{
				op: 'http.server',
				name: 'GET /api/test-sentry',
			},
			async (span) => {
				span.setAttribute('test', 'api-endpoint');
				span.setAttribute('timestamp', new Date().toISOString());

				// Simulate some work
				await new Promise((resolve) => setTimeout(resolve, 100));

				return NextResponse.json({
					success: true,
					message: 'Sentry API test successful!',
					timestamp: new Date().toISOString(),
					tests: [
						'✅ Logger message sent',
						'✅ Capture message sent',
						'✅ Performance span tracked',
					],
				});
			}
		);
	} catch (error) {
		// 4. Error handling
		Sentry.captureException(error);
		logger.error('Error in test-sentry API', {
			error: error instanceof Error ? error.message : 'Unknown error',
		});

		return NextResponse.json(
			{
				success: false,
				message: 'Error occurred during Sentry test',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}

export async function POST() {
	try {
		// Test error handling
		throw new Error('Intentional test error for Sentry');
	} catch (error) {
		Sentry.captureException(error);
		logger.error('Intentional test error captured', {
			endpoint: '/api/test-sentry',
			method: 'POST',
			error: error instanceof Error ? error.message : 'Unknown error',
		});

		return NextResponse.json({
			success: true,
			message: 'Error successfully captured by Sentry',
			error: error instanceof Error ? error.message : 'Unknown error',
		});
	}
}
