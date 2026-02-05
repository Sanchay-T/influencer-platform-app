/**
 * Meta Pixel (Facebook Pixel) Event Tracking
 *
 * @context Tracks conversion events for Meta Ads optimization.
 * Pixel is initialized in app/layout.tsx, this file provides
 * type-safe event tracking functions.
 */

declare global {
	interface Window {
		fbq?: (action: string, event: string, params?: Record<string, unknown>) => void;
	}
}

/**
 * Fire a Meta Pixel event
 */
export function trackMetaEvent(event: string, params?: Record<string, unknown>): void {
	if (typeof window !== 'undefined' && window.fbq) {
		window.fbq('track', event, params);
	}
}

/**
 * Track lead/signup (account created, before payment)
 * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
 */
export function trackLead(): void {
	trackMetaEvent('Lead');
}

/**
 * Track user registration/signup completion
 * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
 */
export function trackCompleteRegistration(): void {
	trackMetaEvent('CompleteRegistration');
}

/**
 * Track trial start
 */
export function trackStartTrial(planId: string): void {
	trackMetaEvent('StartTrial', { content_name: planId });
}

/**
 * Track purchase with value
 */
export function trackPurchase(value: number, currency: string, planId: string): void {
	trackMetaEvent('Purchase', { value, currency, content_name: planId });
}
