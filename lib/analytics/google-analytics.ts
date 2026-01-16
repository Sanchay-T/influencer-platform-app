/**
 * Google Analytics 4 Event Tracking
 *
 * @context Tracks conversion events for GA4.
 * Client-side: Uses window.gtag (initialized in app/layout.tsx)
 * Server-side: Uses GA4 Measurement Protocol for webhook events
 */

import { structuredConsole } from '@/lib/logging/console-proxy';

declare global {
	interface Window {
		gtag?: (...args: unknown[]) => void;
	}
}

// ============================================================================
// Client-side tracking (for browser)
// ============================================================================

/**
 * Fire a GA4 event from the browser
 */
export function trackGA4Event(eventName: string, params?: Record<string, unknown>): void {
	if (typeof window !== 'undefined' && window.gtag) {
		window.gtag('event', eventName, params);
	}
}

/**
 * Track trial start
 */
export function trackGA4TrialStart(planName: string, value: number): void {
	trackGA4Event('begin_trial', {
		// biome-ignore lint/style/useNamingConvention: GA4 uses snake_case
		plan_name: planName,
		value: value,
		currency: 'USD',
	});
}

/**
 * Track purchase completion
 */
export function trackGA4Purchase(planName: string, value: number): void {
	trackGA4Event('purchase', {
		// biome-ignore lint/style/useNamingConvention: GA4 uses snake_case
		plan_name: planName,
		value: value,
		currency: 'USD',
		// biome-ignore lint/style/useNamingConvention: GA4 uses snake_case
		transaction_id: `txn_${Date.now()}`,
	});
}

/**
 * Track new user signup (client-side)
 */
export function trackGA4SignUp(): void {
	trackGA4Event('sign_up', { method: 'clerk' });
}

// ============================================================================
// Server-side tracking (for webhooks via Measurement Protocol)
// ============================================================================

const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-ZG4F8W3RJD';
const GA4_API_SECRET = process.env.GA4_API_SECRET;

/**
 * Send a GA4 event from the server using Measurement Protocol
 *
 * @see https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
export async function trackGA4ServerEvent(
	eventName: string,
	params: Record<string, unknown>,
	userId: string
): Promise<void> {
	if (!GA4_API_SECRET) {
		structuredConsole.warn('[GA4] Missing GA4_API_SECRET - skipping server-side event');
		return;
	}

	const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;

	const payload = {
		// biome-ignore lint/style/useNamingConvention: GA4 Measurement Protocol uses snake_case
		client_id: userId,
		// biome-ignore lint/style/useNamingConvention: GA4 Measurement Protocol uses snake_case
		user_id: userId,
		events: [
			{
				name: eventName,
				params: {
					...params,
					// biome-ignore lint/style/useNamingConvention: GA4 Measurement Protocol uses snake_case
					engagement_time_msec: 100,
					// biome-ignore lint/style/useNamingConvention: GA4 Measurement Protocol uses snake_case
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
