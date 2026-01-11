import { NextResponse } from 'next/server';
import {
	trackSearchStarted,
	trackSubscriptionCanceled,
	trackTrialConverted,
} from '@/lib/analytics/logsnag';

export async function GET() {
	const testEmail = 'test@usegems.io';
	const results: Record<string, string> = {};

	try {
		// Test 1: Trial Converted
		await trackTrialConverted({
			email: testEmail,
			plan: 'Viral Surge',
			value: 249,
		});
		results.trackTrialConverted = 'sent';

		// Test 2: Subscription Canceled
		await trackSubscriptionCanceled({
			email: testEmail,
			plan: 'Glow Up',
		});
		results.trackSubscriptionCanceled = 'sent';

		// Test 3: Search Started
		await trackSearchStarted({
			userId: 'test-user-123',
			platform: 'TikTok',
			type: 'keyword',
			targetCount: 500,
			email: testEmail,
		});
		results.trackSearchStarted = 'sent';

		return NextResponse.json({
			success: true,
			message: 'Check your LogSnag dashboard for 3 test events',
			results,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message, results }, { status: 500 });
	}
}
