/**
 * Unified Analytics Tracking
 *
 * @context Single entry point for all analytics tracking.
 * Client-side: pushes to GTM dataLayer (GTM routes to GA4, Meta, Google Ads).
 * Server-side: sends to GA4 Measurement Protocol + LogSnag.
 *
 * @why Consolidates tracking to ensure consistent event firing across all platforms.
 * Every event includes email, name, and userId for consistent user identification.
 *
 * NOTE: Server-only utilities (getUserDataForTracking) are in track-server-utils.ts
 */

import { structuredConsole } from '@/lib/logging/console-proxy';
import type { AnalyticsEvent, EventPropertiesMap } from './events';
import { trackGA4ServerEvent } from './google-analytics';
import { pushToDataLayer } from './gtm';
import {
	trackCampaignCreated,
	trackCreatorSaved,
	trackCsvExported,
	trackListCreated,
	trackOnboardingStep,
	trackPaidCustomer,
	trackSearchRan,
	trackSearchStarted,
	trackSubscriptionCanceled,
	trackTrialConverted,
	trackTrialStarted,
	trackUserSignedIn,
	trackUserSignup,
} from './logsnag';

export type AnalyticsPayload = {
	[E in AnalyticsEvent]: {
		event: E;
		properties: EventPropertiesMap[E];
	};
}[AnalyticsEvent];

// ============================================================================
// Client-side tracking (browser only)
// ============================================================================

/**
 * Track an event from the browser (client-side)
 *
 * Product analytics events (login, onboarding steps, checkout clicks) are
 * tracked server-side via LogSnag + GA4 Measurement Protocol.
 * GTM dataLayer only gets the 3 conversion events: sign_up, begin_trial, purchase.
 * Use trackLeadClient() and trackPurchaseClient() for those.
 */
export function trackClient(_payload: AnalyticsPayload): void {
	// No-op: product analytics events don't need GTM.
	// Conversion events use trackLeadClient() and trackPurchaseClient() instead.
}

// ============================================================================
// Server-side tracking (API routes, webhooks)
// ============================================================================

/**
 * Track an event from the server (API routes, webhooks)
 *
 * Use this for events triggered in API routes or Stripe/Clerk webhooks.
 * Sends to GA4 (Measurement Protocol), and LogSnag.
 */
export async function trackServer(payload: AnalyticsPayload): Promise<void> {
	switch (payload.event) {
		case 'user_signed_up': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent('sign_up', { method: 'clerk' }, props.userId),
				trackUserSignup({ email: props.email, name: props.name }),
			]);
			break;
		}

		case 'user_signed_in': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent('login', { method: 'clerk' }, props.userId),
				trackUserSignedIn({
					email: props.email || '',
					name: props.name || '',
					userId: props.userId,
				}),
			]);
			break;
		}

		case 'onboarding_step_completed': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					`onboarding_step_${props.step}`,
					{
						step_name: props.stepName,
					},
					props.userId || ''
				),
				trackOnboardingStep({
					email: props.email || '',
					name: props.name || '',
					userId: props.userId || '',
					step: props.step,
					stepName: props.stepName,
				}),
			]);
			break;
		}

		case 'trial_started': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					'begin_trial',
					{
						plan_name: props.plan,
						value: props.value,
						currency: 'USD',
					},
					props.userId
				),
				trackTrialStarted({
					email: props.email,
					name: props.name,
					userId: props.userId,
					plan: props.plan,
				}),
			]);
			break;
		}

		case 'trial_converted': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					'purchase',
					{
						plan_name: props.plan,
						value: props.value,
						currency: 'USD',
						transaction_id: `trial_conv_${Date.now()}`,
					},
					props.userId
				),
				trackTrialConverted({
					email: props.email,
					name: props.name,
					userId: props.userId,
					plan: props.plan,
					value: props.value,
				}),
			]);
			break;
		}

		case 'subscription_created': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					'purchase',
					{
						plan_name: props.plan,
						value: props.value,
						currency: 'USD',
						transaction_id: `sub_${Date.now()}`,
					},
					props.userId
				),
				trackPaidCustomer({
					email: props.email,
					name: props.name,
					userId: props.userId,
					plan: props.plan,
					value: props.value,
				}),
			]);
			break;
		}

		case 'subscription_canceled': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					'subscription_canceled',
					{
						plan_name: props.plan,
					},
					props.userId
				),
				trackSubscriptionCanceled({
					email: props.email,
					name: props.name,
					userId: props.userId,
					plan: props.plan,
				}),
			]);
			break;
		}

		case 'campaign_created': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					'campaign_created',
					{
						campaign_name: props.campaignName,
					},
					props.userId
				),
				trackCampaignCreated({
					userId: props.userId,
					campaignName: props.campaignName,
					email: props.email,
					userName: props.userName,
				}),
			]);
			break;
		}

		case 'search_started': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					'search_started',
					{
						platform: props.platform,
						search_type: props.type,
						target_count: props.targetCount,
					},
					props.userId
				),
				trackSearchStarted({
					userId: props.userId,
					platform: props.platform,
					type: props.type,
					targetCount: props.targetCount,
					email: props.email,
					name: props.name,
				}),
			]);
			break;
		}

		case 'search_completed': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					'search',
					{
						platform: props.platform,
						search_type: props.type,
						creator_count: props.creatorCount,
					},
					props.userId
				),
				trackSearchRan({
					userId: props.userId,
					platform: props.platform,
					type: props.type,
					creatorCount: props.creatorCount,
					email: props.email,
					name: props.name,
				}),
			]);
			break;
		}

		case 'list_created': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					'list_created',
					{
						list_name: props.listName,
						list_type: props.type,
					},
					props.userId
				),
				trackListCreated({
					userId: props.userId,
					listName: props.listName,
					type: props.type,
					email: props.email,
					userName: props.userName,
				}),
			]);
			break;
		}

		case 'creator_saved': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					'add_to_list',
					{
						list_name: props.listName,
						item_count: props.count,
					},
					props.userId
				),
				trackCreatorSaved({
					userId: props.userId,
					listName: props.listName,
					count: props.count,
					email: props.email,
					userName: props.userName,
				}),
			]);
			break;
		}

		case 'csv_exported': {
			const props = payload.properties;
			await Promise.all([
				trackGA4ServerEvent(
					'export',
					{
						export_type: 'csv',
						creator_count: props.creatorCount,
						source: props.source,
					},
					props.userId
				),
				trackCsvExported({
					userId: props.userId,
					email: props.email,
					name: props.name,
					creatorCount: props.creatorCount,
					source: props.source,
				}),
			]);
			break;
		}

		default:
			structuredConsole.warn(`[Analytics] Unknown server event: ${payload.event}`);
	}
}

// ============================================================================
// Hybrid tracking (works on both client and server)
// ============================================================================

/**
 * Client-side tracking for Signup event (new user created)
 * @why Fires sign_up via GTM → GA4 + Meta Lead
 */
export function trackLeadClient(): void {
	if (typeof window !== 'undefined') {
		pushToDataLayer({ event: 'sign_up', method: 'clerk' });
	}
}

/**
 * Client-side tracking for trial/purchase events
 * Call this on the success page after Stripe checkout
 * @why Fires begin_trial or purchase via GTM → GA4 + Meta + Google Ads
 */
export function trackPurchaseClient(value: number, planId: string, isTrial: boolean): void {
	if (typeof window === 'undefined') return;

	if (isTrial) {
		pushToDataLayer({
			event: 'begin_trial',
			plan_name: planId,
			value,
			currency: 'USD',
		});
	} else {
		pushToDataLayer({
			event: 'purchase',
			plan_name: planId,
			value,
			currency: 'USD',
			transaction_id: `txn_${Date.now()}`,
		});
	}
}
