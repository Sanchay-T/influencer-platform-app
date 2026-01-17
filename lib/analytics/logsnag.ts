/**
 * LogSnag Event Tracking
 *
 * @context Real-time event notifications for user lifecycle and product usage.
 * Events are sent to LogSnag for monitoring signups, trials, payments, and usage.
 *
 * @why Every event includes email, name, and userId for consistent user identification.
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
		tags: { email: data.email, name: data.name },
		notify: true,
	});
}

export async function trackUserSignedIn(data: {
	email: string;
	name: string;
	userId: string;
}): Promise<void> {
	await track({
		channel: 'users',
		event: 'User Signed In',
		icon: '🔑',
		description: `${data.name} (${data.email})`,
		tags: { email: data.email, name: data.name, userId: data.userId },
	});
}

// ============================================================================
// Onboarding Events
// ============================================================================

export async function trackOnboardingStep(data: {
	email: string;
	name: string;
	userId: string;
	step: number;
	stepName: string;
}): Promise<void> {
	await track({
		channel: 'onboarding',
		event: `Onboarding Step ${data.step}`,
		icon: data.step === 3 ? '💳' : '📝',
		description: `${data.name} (${data.email}) completed ${data.stepName}`,
		tags: {
			email: data.email,
			name: data.name,
			userId: data.userId,
			step: data.step,
			stepName: data.stepName,
		},
	});
}

// ============================================================================
// Billing Events
// ============================================================================

export async function trackTrialStarted(data: {
	email: string;
	name: string;
	userId: string;
	plan: string;
}): Promise<void> {
	await track({
		channel: 'billing',
		event: 'Trial Started',
		icon: '🎁',
		description: `${data.name} (${data.email}) started ${data.plan} trial`,
		tags: { email: data.email, name: data.name, userId: data.userId, plan: data.plan },
		notify: true,
	});
}

export async function trackPaidCustomer(data: {
	email: string;
	name: string;
	userId: string;
	plan: string;
	value: number;
}): Promise<void> {
	await track({
		channel: 'billing',
		event: 'New Paid Customer',
		icon: '💰',
		description: `${data.name} (${data.email}) subscribed to ${data.plan} ($${data.value}/mo)`,
		tags: {
			email: data.email,
			name: data.name,
			userId: data.userId,
			plan: data.plan,
			value: data.value,
		},
		notify: true,
	});
}

export async function trackTrialConverted(data: {
	email: string;
	name: string;
	userId: string;
	plan: string;
	value: number;
}): Promise<void> {
	await track({
		channel: 'billing',
		event: 'Trial Converted',
		icon: '🎉',
		description: `${data.name} (${data.email}) converted from trial to ${data.plan} ($${data.value}/mo)`,
		tags: {
			email: data.email,
			name: data.name,
			userId: data.userId,
			plan: data.plan,
			value: data.value,
		},
		notify: true,
	});
}

export async function trackSubscriptionCanceled(data: {
	email: string;
	name: string;
	userId: string;
	plan: string;
}): Promise<void> {
	await track({
		channel: 'billing',
		event: 'Subscription Canceled',
		icon: '😢',
		description: `${data.name} (${data.email}) canceled ${data.plan}`,
		tags: { email: data.email, name: data.name, userId: data.userId, plan: data.plan },
		notify: true,
	});
}

// ============================================================================
// Product Usage Events
// ============================================================================

export async function trackSearchStarted(data: {
	userId: string;
	platform: string;
	type: string;
	targetCount: number;
	email: string;
	name: string;
}): Promise<void> {
	await track({
		channel: 'searches',
		event: 'Search Started',
		icon: '🚀',
		description: `${data.name} (${data.email}): ${data.platform} ${data.type} targeting ${data.targetCount} creators`,
		tags: {
			userId: data.userId,
			platform: data.platform,
			type: data.type,
			targetCount: data.targetCount,
			email: data.email,
			name: data.name,
		},
	});
}

export async function trackSearchRan(data: {
	userId: string;
	platform: string;
	type: string;
	creatorCount: number;
	email: string;
	name: string;
}): Promise<void> {
	await track({
		channel: 'searches',
		event: 'Search Completed',
		icon: '🔍',
		description: `${data.name} (${data.email}): ${data.platform} ${data.type} found ${data.creatorCount} creators`,
		tags: {
			userId: data.userId,
			platform: data.platform,
			type: data.type,
			creators: data.creatorCount,
			email: data.email,
			name: data.name,
		},
	});
}

export async function trackCampaignCreated(data: {
	userId: string;
	campaignName: string;
	email: string;
	userName: string;
}): Promise<void> {
	await track({
		channel: 'campaigns',
		event: 'Campaign Created',
		icon: '📋',
		description: `${data.userName} (${data.email}): Campaign "${data.campaignName}"`,
		tags: { userId: data.userId, email: data.email, name: data.userName },
	});
}

export async function trackListCreated(data: {
	userId: string;
	listName: string;
	type: string;
	email: string;
	userName: string;
}): Promise<void> {
	await track({
		channel: 'lists',
		event: 'List Created',
		icon: '📝',
		description: `${data.userName} (${data.email}): List "${data.listName}" (${data.type})`,
		tags: { userId: data.userId, type: data.type, email: data.email, name: data.userName },
	});
}

export async function trackCreatorSaved(data: {
	userId: string;
	listName: string;
	count: number;
	email: string;
	userName: string;
}): Promise<void> {
	await track({
		channel: 'lists',
		event: 'Creators Saved',
		icon: '⭐',
		description: `${data.userName} (${data.email}): ${data.count} creator(s) saved to "${data.listName}"`,
		tags: { userId: data.userId, count: data.count, email: data.email, name: data.userName },
	});
}

export async function trackCsvExported(data: {
	userId: string;
	email: string;
	name: string;
	creatorCount: number;
	source: 'campaign' | 'list';
}): Promise<void> {
	await track({
		channel: 'exports',
		event: 'CSV Exported',
		icon: '📊',
		description: `${data.name} (${data.email}): Exported ${data.creatorCount} creators from ${data.source}`,
		tags: {
			userId: data.userId,
			email: data.email,
			name: data.name,
			creatorCount: data.creatorCount,
			source: data.source,
		},
	});
}
