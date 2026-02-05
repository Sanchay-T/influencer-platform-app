/**
 * Analytics Tracking API
 *
 * @context Forwards client-side events to LogSnag.
 * This allows client components to trigger LogSnag events without exposing the token.
 *
 * @why Client-side tracking only goes to GA4/Meta. This endpoint bridges to LogSnag.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { trackUserSignedIn } from '@/lib/analytics/logsnag';
import { LogCategory, logger } from '@/lib/logging';

// Events that can be tracked via this endpoint
type TrackableEvent = 'user_signed_in';

interface TrackRequest {
	event: TrackableEvent;
	properties: {
		userId: string;
		email?: string;
		name?: string;
	};
}

export async function POST(request: Request) {
	try {
		// Verify the user is authenticated
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = (await request.json()) as TrackRequest;
		const { event, properties } = body;

		// Validate the request
		if (!(event && properties)) {
			return NextResponse.json({ error: 'Missing event or properties' }, { status: 400 });
		}

		// Verify the userId matches the authenticated user (prevent spoofing)
		if (properties.userId !== userId) {
			return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
		}

		// Route to appropriate LogSnag tracker
		switch (event) {
			case 'user_signed_in':
				await trackUserSignedIn({
					userId: properties.userId,
					email: properties.email || '',
					name: properties.name || '',
				});
				break;

			default:
				return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error(
			'[Analytics API] Error tracking event',
			error instanceof Error ? error : new Error(String(error)),
			undefined,
			LogCategory.API
		);
		return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
	}
}
