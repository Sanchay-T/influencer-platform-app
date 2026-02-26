/**
 * Google Tag Manager DataLayer Integration
 *
 * @context Provides type-safe dataLayer.push() for all client-side analytics.
 * GTM container handles routing events to GA4, Meta Pixel, and Google Ads.
 *
 * @why Replaces direct gtag/fbq/conversion calls with a single dataLayer interface.
 * All event routing logic lives in the GTM container UI, not in application code.
 */

// ============================================================================
// DataLayer Type Definitions
// ============================================================================

type DataLayerEvent =
	| { event: 'login'; method: string; user_id: string }
	| { event: 'sign_up'; method: string }
	| { event: 'lead' }
	| { event: 'onboarding_step'; step: number; step_name: string }
	| { event: 'complete_registration'; method: string }
	| { event: 'begin_checkout'; source: string; current_plan?: string; target_plan?: string }
	| { event: 'initiate_checkout'; content_name?: string; content_category: string }
	| { event: 'begin_trial'; plan_name: string; value: number; currency: string }
	| { event: 'start_trial'; content_name: string }
	| {
			event: 'purchase';
			plan_name: string;
			value: number;
			currency: string;
			transaction_id: string;
	  }
	| { event: 'purchase_meta'; value: number; currency: string; content_name: string }
	| {
			event: 'google_ads_conversion';
			send_to: string;
			value: number;
			currency: string;
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
