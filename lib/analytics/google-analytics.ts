/**
 * Google Analytics 4 Server-side Tracking
 *
 * @context Server-side GA4 tracking via Measurement Protocol for webhook events.
 * Client-side tracking is handled by GTM dataLayer (see lib/analytics/gtm.ts).
 */

import { structuredConsole } from '@/lib/logging/console-proxy';

// ============================================================================
// Server-side tracking (for webhooks via Measurement Protocol)
// ============================================================================

// GA4 Measurement ID - uses env var, falls back to test property
// Production (Vercel): Set GA4_MEASUREMENT_ID=G-HQL4LR0B0G
// Development: Falls back to G-ZG4F8W3RJD (test property)
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-ZG4F8W3RJD';
const GA4_API_SECRET = process.env.GA4_API_SECRET;

/**
 * Send a GA4 event from the server using Measurement Protocol
 *
 * Events go to whichever GA4 property is configured via GA4_MEASUREMENT_ID:
 * - Production (Vercel): G-HQL4LR0B0G (clean property)
 * - Development: G-ZG4F8W3RJD (test property)
 *
 * @see https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
export async function trackGA4ServerEvent(
	eventName: string,
	params: Record<string, unknown>,
	userId: string
): Promise<void> {
	if (!GA4_API_SECRET) {
		structuredConsole.log(`[GA4] Missing GA4_API_SECRET - skipping: ${eventName}`);
		return;
	}

	const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;

	const payload = {
		client_id: userId,
		user_id: userId,
		events: [
			{
				name: eventName,
				params: {
					...params,
					engagement_time_msec: 100,
					session_id: Date.now().toString(),
				},
			},
		],
	};

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			structuredConsole.error(`[GA4] Measurement Protocol error: ${response.status}`);
		}
	} catch (error) {
		// Don't throw - analytics should never break the main flow
		structuredConsole.error('[GA4] Failed to send server event:', error);
	}
}

/**
 * Track signup from server (Clerk webhook)
 */
export async function trackGA4ServerSignup(userId: string): Promise<void> {
	await trackGA4ServerEvent('sign_up', { method: 'clerk' }, userId);
}
