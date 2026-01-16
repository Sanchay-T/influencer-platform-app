/**
 * Unified Analytics Tracking
 *
 * @context Single entry point for all analytics tracking.
 * Sends events to GA4, Meta Pixel, and LogSnag simultaneously.
 *
 * @why Consolidates tracking to ensure consistent event firing across all platforms.
 * Previously, some events only went to LogSnag while others only went to GA4/Meta.
 */

import type {
	AnalyticsEvent,
	CampaignCreatedProps,
	CreatorSavedProps,
	CsvExportedProps,
	EventPropertiesMap,
	ListCreatedProps,
	OnboardingStepProps,
	SearchCompletedProps,
	SearchStartedProps,
	SubscriptionCanceledProps,
	SubscriptionCreatedProps,
	TrialStartedProps,
	UpgradeClickedProps,
	UserSignedInProps,
	UserSignedUpProps,
} from './events';
import { trackGA4Event, trackGA4ServerEvent, trackGA4SignUp } from './google-analytics';
import {
	trackCampaignCreated,
	trackCreatorSaved,
	trackListCreated,
	trackPaidCustomer,
	trackSearchRan,
	trackSearchStarted,
	trackSubscriptionCanceled,
	trackTrialConverted,
	trackTrialStarted,
	trackUserSignup,
} from './logsnag';
import {
	trackCompleteRegistration,
	trackLead,
	trackMetaEvent,
	trackPurchase,
	trackStartTrial,
} from './meta-pixel';

// ============================================================================
// Client-side tracking (browser only)
// ============================================================================

/**
 * Track an event from the browser (client-side)
 *
 * Use this for events triggered by user interactions in React components.
 * Sends to GA4 and Meta Pixel.
 */
export function trackClient<E extends AnalyticsEvent>(
	event: E,
	properties: EventPropertiesMap[E]
): void {
	if (typeof window === 'undefined') {
		console.warn('[Analytics] trackClient called on server - use trackServer instead');
		return;
	}

	switch (event) {
		case 'user_signed_in': {
			const props = properties as UserSignedInProps;
			trackGA4Event('login', { method: 'clerk', user_id: props.userId });
			break;
		}

		case 'onboarding_step_completed': {
			const props = properties as OnboardingStepProps;
			trackGA4Event(`onboarding_step_${props.step}`, { step_name: props.stepName });
			break;
		}

		case 'onboarding_completed': {
			trackGA4Event('complete_registration', { method: 'onboarding' });
			trackCompleteRegistration();
			break;
		}

		case 'upgrade_clicked': {
			const props = properties as UpgradeClickedProps;
			trackGA4Event('begin_checkout', {
				source: props.source,
				current_plan: props.currentPlan,
				target_plan: props.targetPlan,
			});
			trackMetaEvent('InitiateCheckout', {
				content_name: props.targetPlan,
				content_category: 'subscription',
			});
			break;
		}

		default:
			console.warn(`[Analytics] Unknown client event: ${event}`);
	}
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
export async function trackServer<E extends AnalyticsEvent>(
	event: E,
	properties: EventPropertiesMap[E]
): Promise<void> {
	switch (event) {
		case 'user_signed_up': {
			const props = properties as UserSignedUpProps;
			await Promise.all([
				trackGA4ServerEvent('sign_up', { method: 'clerk' }, props.userId),
				trackUserSignup({ email: props.email, name: props.name }),
			]);
			break;
		}

		case 'trial_started': {
			const props = properties as TrialStartedProps;
			await Promise.all([
				trackGA4ServerEvent(
					'begin_trial',
					{ plan_name: props.plan, value: props.value, currency: 'USD' },
					props.userId
				),
				trackTrialStarted({ email: props.email, plan: props.plan }),
			]);
			break;
		}

		case 'trial_converted': {
			const props = properties as SubscriptionCreatedProps;
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
				trackTrialConverted({ email: props.email, plan: props.plan, value: props.value }),
			]);
			break;
		}

		case 'subscription_created': {
			const props = properties as SubscriptionCreatedProps;
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
				trackPaidCustomer({ email: props.email, plan: props.plan, value: props.value }),
			]);
			break;
		}

		case 'subscription_canceled': {
			const props = properties as SubscriptionCanceledProps;
			await Promise.all([
				trackGA4ServerEvent('subscription_canceled', { plan_name: props.plan }, props.userId),
				trackSubscriptionCanceled({ email: props.email, plan: props.plan }),
			]);
			break;
		}

		case 'campaign_created': {
			const props = properties as CampaignCreatedProps;
			await Promise.all([
				trackGA4ServerEvent('campaign_created', { campaign_name: props.name }, props.userId),
				trackCampaignCreated({ userId: props.userId, name: props.name, email: props.email }),
			]);
			break;
		}

		case 'search_started': {
			const props = properties as SearchStartedProps;
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
				}),
			]);
			break;
		}

		case 'search_completed': {
			const props = properties as SearchCompletedProps;
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
				}),
			]);
			break;
		}

		case 'list_created': {
			const props = properties as ListCreatedProps;
			await Promise.all([
				trackGA4ServerEvent(
					'list_created',
					{ list_name: props.name, list_type: props.type },
					props.userId
				),
				trackListCreated({
					userId: props.userId,
					name: props.name,
					type: props.type,
					email: props.email,
				}),
			]);
			break;
		}

		case 'creator_saved': {
			const props = properties as CreatorSavedProps;
			await Promise.all([
				trackGA4ServerEvent(
					'add_to_list',
					{ list_name: props.listName, item_count: props.count },
					props.userId
				),
				trackCreatorSaved({
					userId: props.userId,
					listName: props.listName,
					count: props.count,
					email: props.email,
				}),
			]);
			break;
		}

		case 'csv_exported': {
			const props = properties as CsvExportedProps;
			await trackGA4ServerEvent(
				'export',
				{
					export_type: 'csv',
					creator_count: props.creatorCount,
					source: props.source,
				},
				props.userId
			);
			// LogSnag doesn't have this event yet, but we can add it
			break;
		}

		default:
			console.warn(`[Analytics] Unknown server event: ${event}`);
	}
}

// ============================================================================
// Hybrid tracking (works on both client and server)
// ============================================================================

/**
 * Client-side tracking for Lead/SignUp event (new user created, before payment)
 * Call this when a new user is created on the client
 * @why Fires both Meta Pixel "Lead" and GA4 "sign_up" for consistent funnel tracking
 */
export function trackLeadClient(): void {
	if (typeof window !== 'undefined') {
		trackLead(); // Meta Pixel "Lead"
		trackGA4SignUp(); // GA4 "sign_up"
	}
}

/**
 * Client-side tracking for purchase events
 * Call this on the success page after Stripe checkout
 */
export function trackPurchaseClient(value: number, planId: string, isTrial: boolean): void {
	if (typeof window === 'undefined') return;

	if (isTrial) {
		trackStartTrial(planId);
		trackGA4Event('begin_trial', {
			plan_name: planId,
			value: value,
			currency: 'USD',
		});
	} else {
		trackPurchase(value, 'USD', planId);
		trackGA4Event('purchase', {
			plan_name: planId,
			value: value,
			currency: 'USD',
			transaction_id: `txn_${Date.now()}`,
		});
	}
}
