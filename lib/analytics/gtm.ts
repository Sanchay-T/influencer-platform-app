/**
 * Google Tag Manager DataLayer Integration
 *
 * @context Pushes conversion events to GTM dataLayer.
 * GTM container routes these to GA4, Meta Pixel, and Google Ads.
 *
 * Only 3 conversion events + user identification:
 * - sign_up: new user created
 * - begin_trial: trial subscription started
 * - purchase: paid subscription (direct or trial conversion on client)
 */

// ============================================================================
// DataLayer Type Definitions
// ============================================================================

type DataLayerEvent =
	| { event: 'sign_up'; method: string }
	| { event: 'begin_trial'; plan_name: string; value: number; currency: string }
	| {
			event: 'purchase';
			plan_name: string;
			value: number;
			currency: string;
			transaction_id: string;
	  }
	| { event: 'set_user_id'; user_id: string };

declare global {
	// biome-ignore lint/suspicious/noEmptyInterface: Window augmentation for GTM dataLayer
	interface Window {
		dataLayer?: Array<DataLayerEvent | Record<string, unknown>>;
	}
}

// ============================================================================
// Core DataLayer Push
// ============================================================================

/**
 * Push a typed event to the GTM dataLayer.
 * Safe to call on server (no-ops) and before GTM loads (events are queued).
 */
export function pushToDataLayer(event: DataLayerEvent): void {
	if (typeof window === 'undefined') return;
	window.dataLayer = window.dataLayer || [];
	window.dataLayer.push(event);
}
