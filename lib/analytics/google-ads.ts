/**
 * Google Ads Conversion Tracking
 *
 * @context Tracks conversion events for Google Ads optimization.
 * gtag is initialized in app/layout.tsx, this file provides
 * type-safe conversion tracking functions.
 *
 * Conversion: Submit lead form
 * Account: AW-17893774225
 * Label: QpdlCMSw8OkbEJGntdRC
 */

declare global {
	interface Window {
		gtag?: (...args: unknown[]) => void;
	}
}

// Google Ads conversion configuration
const GOOGLE_ADS_CONVERSION_ID = 'AW-17893774225';
const GOOGLE_ADS_CONVERSION_LABEL = 'QpdlCMSw8OkbEJGntdRC';
const GOOGLE_ADS_SEND_TO = `${GOOGLE_ADS_CONVERSION_ID}/${GOOGLE_ADS_CONVERSION_LABEL}`;

/**
 * Track a Google Ads conversion event (page load)
 * Fires the "Submit lead form" conversion
 *
 * @param value - Conversion value in USD (default: 1.0)
 * @param callback - Optional callback after conversion is sent
 */
export function trackGoogleAdsConversion(value = 1.0, callback?: () => void): void {
	if (typeof window === 'undefined' || !window.gtag) {
		callback?.();
		return;
	}

	window.gtag('event', 'conversion', {
		send_to: GOOGLE_ADS_SEND_TO,
		value: value,
		currency: 'USD',
		event_callback: callback,
	});
}

/**
 * Track conversion with navigation (click-based)
 * Use this when the conversion should redirect after tracking
 *
 * @param url - URL to navigate to after conversion is tracked
 * @param value - Conversion value in USD (default: 1.0)
 */
export function trackGoogleAdsConversionWithRedirect(url: string, value = 1.0): boolean {
	if (typeof window === 'undefined' || !window.gtag) {
		if (typeof window !== 'undefined' && url) {
			window.location.href = url;
		}
		return false;
	}

	const callback = () => {
		if (url) {
			window.location.href = url;
		}
	};

	window.gtag('event', 'conversion', {
		send_to: GOOGLE_ADS_SEND_TO,
		value: value,
		currency: 'USD',
		event_callback: callback,
	});

	return false;
}

/**
 * Track lead conversion (alias for trackGoogleAdsConversion)
 * Use this when a user completes trial signup or subscription
 */
export function trackLeadConversion(value = 1.0): void {
	trackGoogleAdsConversion(value);
}
