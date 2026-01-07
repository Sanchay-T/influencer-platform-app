/**
 * LogSnag Event Tracking
 *
 * @context Real-time event notifications for user lifecycle and product usage.
 * Events are sent to LogSnag for monitoring signups, trials, payments, and usage.
 */

import { LogSnag } from 'logsnag';

// Project name can be configured via env var, defaults to 'usegemz'
const PROJECT_NAME = process.env.LOGSNAG_PROJECT || 'usegemz';

const logsnag = new LogSnag({
	token: process.env.LOGSNAG_TOKEN!,
	project: PROJECT_NAME,
});

interface TrackOptions {
	channel: string;
	event: string;
	icon: string;
	description?: string;
	tags?: Record<string, string | number | boolean>;
	notify?: boolean;
}

/**
 * Safely track an event without blocking the request
 */
async function track(options: TrackOptions): Promise<void> {
	if (!process.env.LOGSNAG_TOKEN) {
		console.warn('[LogSnag] LOGSNAG_TOKEN not set, skipping event:', options.event);
		return;
	}

	try {
		console.log('[LogSnag] Tracking event:', options.event, 'to project:', PROJECT_NAME);
		await logsnag.track(options);
		console.log('[LogSnag] Event sent successfully:', options.event);
	} catch (error) {
		// Log but don't throw - analytics shouldn't break the app
		console.error('[LogSnag] Failed to track event:', options.event, error);
	}
}

// ============================================================================
// User Events
// ============================================================================

export async function trackUserSignup(data: { email: string; name: string }): Promise<void> {
	await track({
		channel: 'users',
		event: 'User Signed Up',
		icon: '👤',
		description: `${data.name} (${data.email})`,
		tags: { email: data.email },
		notify: true,
	});
}

// ============================================================================
// Billing Events
// ============================================================================

export async function trackTrialStarted(data: { email: string; plan: string }): Promise<void> {
	await track({
		channel: 'billing',
		event: 'Trial Started',
		icon: '🎁',
		description: `${data.email} started ${data.plan} trial`,
		tags: { email: data.email, plan: data.plan },
		notify: true,
	});
}

export async function trackPaidCustomer(data: {
	email: string;
	plan: string;
	value: number;
}): Promise<void> {
	await track({
		channel: 'billing',
		event: 'New Paid Customer',
		icon: '💰',
		description: `${data.email} subscribed to ${data.plan} ($${data.value}/mo)`,
		tags: { email: data.email, plan: data.plan, value: data.value },
		notify: true,
	});
}

// ============================================================================
// Product Usage Events
// ============================================================================

export async function trackCampaignCreated(data: {
	userId: string;
	name: string;
	email: string;
}): Promise<void> {
	await track({
		channel: 'campaigns',
		event: 'Campaign Created',
		icon: '📋',
		description: `Campaign: ${data.name}`,
		tags: { userId: data.userId, email: data.email },
	});
}

export async function trackSearchRan(data: {
	userId: string;
	platform: string;
	type: string;
	creatorCount: number;
	email: string;
}): Promise<void> {
	await track({
		channel: 'searches',
		event: 'Search Completed',
		icon: '🔍',
		description: `${data.platform} ${data.type}: ${data.creatorCount} creators found`,
		tags: {
			userId: data.userId,
			platform: data.platform,
			type: data.type,
			creators: data.creatorCount,
			email: data.email,
		},
	});
}

export async function trackListCreated(data: {
	userId: string;
	name: string;
	type: string;
	email: string;
}): Promise<void> {
	await track({
		channel: 'lists',
		event: 'List Created',
		icon: '📝',
		description: `List: ${data.name} (${data.type})`,
		tags: { userId: data.userId, type: data.type, email: data.email },
	});
}

export async function trackCreatorSaved(data: {
	userId: string;
	listName: string;
	count: number;
	email: string;
}): Promise<void> {
	await track({
		channel: 'lists',
		event: 'Creators Saved',
		icon: '⭐',
		description: `${data.count} creator(s) saved to ${data.listName}`,
		tags: { userId: data.userId, count: data.count, email: data.email },
	});
}
