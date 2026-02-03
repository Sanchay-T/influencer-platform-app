import {
	hide,
	showNewMessage as intercomShowNewMessage,
	show,
	shutdown,
	trackEvent,
	update,
} from '@intercom/messenger-js-sdk';

/**
 * Intercom Event Tracking Utilities (Official SDK)
 *
 * @see https://developers.intercom.com/installing-intercom/web/methods
 */

/**
 * Track a custom event in Intercom
 */
export function trackIntercomEvent(eventName: string, metadata?: Record<string, unknown>): void {
	if (typeof window !== 'undefined') {
		trackEvent(eventName, metadata);
	}
}

/**
 * Show the Intercom messenger
 */
export function showIntercom(): void {
	if (typeof window !== 'undefined') {
		show();
	}
}

/**
 * Hide the Intercom messenger
 */
export function hideIntercom(): void {
	if (typeof window !== 'undefined') {
		hide();
	}
}

/**
 * Open a new message with optional pre-populated text
 */
export function showNewMessage(prePopulatedMessage?: string): void {
	if (typeof window !== 'undefined' && prePopulatedMessage) {
		intercomShowNewMessage(prePopulatedMessage);
	}
}

/**
 * Update Intercom with new user data
 */
export function updateIntercom(data: Record<string, unknown>): void {
	if (typeof window !== 'undefined') {
		update(data);
	}
}

/**
 * Shutdown Intercom (e.g., on logout)
 */
export function shutdownIntercom(): void {
	if (typeof window !== 'undefined') {
		shutdown();
	}
}
