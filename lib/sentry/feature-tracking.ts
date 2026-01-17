/**
 * Feature-Specific Sentry Tracking
 *
 * Provides specialized error tracking and monitoring for each feature area.
 * Use these helpers to ensure consistent and detailed error reporting.
 *
 * @example
 * ```typescript
 * import { searchTracker, billingTracker, onboardingTracker } from '@/lib/sentry/feature-tracking';
 *
 * // Track a search operation
 * await searchTracker.trackSearch({
 *   platform: 'tiktok',
 *   searchType: 'keyword',
 *   query: 'fitness influencer',
 *   userId: 'user_123',
 * }, async () => {
 *   // Your search code here
 * });
 *
 * // Track a billing event
 * billingTracker.trackCheckout({ userId, planId, isUpgrade: true });
 * ```
 */

import * as Sentry from '@sentry/nextjs';
import { SentryLogger } from '@/lib/logging/sentry-logger';

// ============================================================================
// SEARCH TRACKING
// ============================================================================

export const searchTracker = {
	/**
	 * Track a search operation with performance monitoring
	 */
	async trackSearch<T>(
		context: {
			platform: 'tiktok' | 'instagram' | 'youtube';
			searchType: 'keyword' | 'similar';
			query?: string;
			username?: string;
			targetCount?: number;
			userId: string;
			campaignId?: string;
			jobId?: string;
		},
		operation: () => Promise<T>
	): Promise<T> {
		return SentryLogger.startSpanAsync(
			{
				name: `search.${context.platform}.${context.searchType}`,
				op: 'search',
				attributes: {
					platform: context.platform,
					searchType: context.searchType,
					userId: context.userId,
					...(context.campaignId ? { campaignId: context.campaignId } : {}),
					...(context.jobId ? { jobId: context.jobId } : {}),
				},
			},
			async () => {
				SentryLogger.addBreadcrumb({
					category: 'search',
					message: `Starting ${context.searchType} search on ${context.platform}`,
					level: 'info',
					data: context,
				});

				try {
					const result = await operation();

					SentryLogger.addBreadcrumb({
						category: 'search',
						message: `Completed ${context.searchType} search on ${context.platform}`,
						level: 'info',
						data: { ...context, success: true },
					});

					return result;
				} catch (error) {
					SentryLogger.captureException(error, {
						tags: {
							feature: 'search',
							platform: context.platform,
							searchType: context.searchType,
						},
						extra: {
							...context,
							errorType: error instanceof Error ? error.name : 'Unknown',
						},
					});
					throw error;
				}
			}
		);
	},

	/**
	 * Track search result count
	 */
	trackResults(context: {
		platform: string;
		searchType: string;
		resultsCount: number;
		duration: number;
		jobId?: string;
	}): void {
		SentryLogger.addBreadcrumb({
			category: 'search',
			message: `Search returned ${context.resultsCount} results`,
			level: 'info',
			data: context,
		});
	},

	/**
	 * Track search failure
	 */
	trackFailure(
		error: Error,
		context: {
			platform: string;
			searchType: string;
			stage: 'init' | 'fetch' | 'parse' | 'save';
			userId: string;
			jobId?: string;
		}
	): void {
		SentryLogger.captureException(error, {
			tags: {
				feature: 'search',
				platform: context.platform,
				searchType: context.searchType,
				stage: context.stage,
			},
			extra: context,
			level: 'error',
		});
	},
};

// ============================================================================
// BILLING TRACKING
// ============================================================================

export const billingTracker = {
	/**
	 * Track checkout initiation
	 */
	trackCheckout(context: {
		userId: string;
		planId: string;
		planName?: string;
		billingCycle: 'monthly' | 'yearly';
		isUpgrade?: boolean;
		source?: string;
	}): void {
		SentryLogger.addBreadcrumb({
			category: 'billing',
			message: 'Checkout initiated',
			level: 'info',
			data: context,
		});

		SentryLogger.setContext('billing', {
			planId: context.planId,
			planName: context.planName,
			billingCycle: context.billingCycle,
			isUpgrade: context.isUpgrade,
		});
	},

	/**
	 * Track successful payment
	 */
	trackPaymentSuccess(context: {
		userId: string;
		planId: string;
		stripeSessionId: string;
		amount?: number;
	}): void {
		SentryLogger.addBreadcrumb({
			category: 'billing',
			message: 'Payment successful',
			level: 'info',
			data: {
				...context,
				amount: context.amount ? `$${(context.amount / 100).toFixed(2)}` : undefined,
			},
		});
	},

	/**
	 * Track payment failure
	 */
	trackPaymentFailure(
		error: Error,
		context: {
			userId: string;
			planId?: string;
			stripeSessionId?: string;
			stage: 'checkout' | 'webhook' | 'verification';
		}
	): void {
		SentryLogger.captureException(error, {
			tags: {
				feature: 'billing',
				stage: context.stage,
			},
			extra: context,
			level: 'error',
		});
	},

	/**
	 * Track webhook processing
	 */
	async trackWebhook<T>(eventType: string, operation: () => Promise<T>): Promise<T> {
		return SentryLogger.startSpanAsync(
			{
				name: `stripe.webhook.${eventType}`,
				op: 'webhook',
				attributes: { eventType },
			},
			async () => {
				try {
					const result = await operation();
					SentryLogger.addBreadcrumb({
						category: 'billing',
						message: `Webhook processed: ${eventType}`,
						level: 'info',
					});
					return result;
				} catch (error) {
					SentryLogger.captureException(error, {
						tags: {
							feature: 'billing',
							webhookType: eventType,
						},
					});
					throw error;
				}
			}
		);
	},

	/**
	 * Track trial events
	 */
	trackTrialEvent(
		event: 'started' | 'ending_soon' | 'expired' | 'converted',
		context: {
			userId: string;
			planId?: string;
			daysRemaining?: number;
		}
	): void {
		SentryLogger.addBreadcrumb({
			category: 'billing',
			message: `Trial ${event}`,
			level: event === 'expired' ? 'warning' : 'info',
			data: context,
		});
	},
};

// ============================================================================
// ONBOARDING TRACKING
// ============================================================================

export const onboardingTracker = {
	/**
	 * Track onboarding step completion
	 */
	trackStep(
		step: 'info_captured' | 'intent_captured' | 'plan_selected' | 'completed',
		context: {
			userId: string;
			duration?: number;
			metadata?: Record<string, unknown>;
		}
	): void {
		SentryLogger.addBreadcrumb({
			category: 'onboarding',
			message: `Completed step: ${step}`,
			level: 'info',
			data: context,
		});
	},

	/**
	 * Track onboarding abandonment
	 */
	trackAbandonment(context: { userId: string; lastStep: string; timeSpent?: number }): void {
		SentryLogger.addBreadcrumb({
			category: 'onboarding',
			message: 'Onboarding abandoned',
			level: 'warning',
			data: context,
		});

		SentryLogger.captureMessage('Onboarding abandoned', 'warning', {
			tags: { feature: 'onboarding', lastStep: context.lastStep },
			extra: context,
		});
	},

	/**
	 * Track onboarding error
	 */
	trackError(
		error: Error,
		context: {
			userId: string;
			step: string;
			action?: string;
		}
	): void {
		SentryLogger.captureException(error, {
			tags: {
				feature: 'onboarding',
				step: context.step,
				...(context.action ? { action: context.action } : {}),
			},
			extra: context,
		});
	},

	/**
	 * Track onboarding completion
	 */
	trackCompletion(context: { userId: string; totalDuration: number; selectedPlan: string }): void {
		SentryLogger.addBreadcrumb({
			category: 'onboarding',
			message: 'Onboarding completed',
			level: 'info',
			data: context,
		});

		SentryLogger.captureMessage('Onboarding completed successfully', 'info', {
			tags: { feature: 'onboarding', plan: context.selectedPlan },
			extra: context,
		});
	},
};

// ============================================================================
// CAMPAIGN TRACKING
// ============================================================================

export const campaignTracker = {
	/**
	 * Track campaign creation
	 */
	trackCreation(context: {
		userId: string;
		campaignId: string;
		searchType: 'keyword' | 'similar';
		name?: string;
	}): void {
		SentryLogger.addBreadcrumb({
			category: 'campaign',
			message: 'Campaign created',
			level: 'info',
			data: context,
		});
	},

	/**
	 * Track campaign error
	 */
	trackError(
		error: Error,
		context: {
			userId: string;
			campaignId?: string;
			action: 'create' | 'update' | 'delete' | 'search';
		}
	): void {
		SentryLogger.captureException(error, {
			tags: {
				feature: 'campaign',
				action: context.action,
			},
			extra: context,
		});
	},
};

// ============================================================================
// LIST TRACKING
// ============================================================================

export const listTracker = {
	/**
	 * Track list operations
	 */
	trackOperation(
		operation: 'create' | 'update' | 'delete' | 'add_creator' | 'remove_creator' | 'export',
		context: {
			userId: string;
			listId?: string;
			creatorCount?: number;
		}
	): void {
		SentryLogger.addBreadcrumb({
			category: 'list',
			message: `List operation: ${operation}`,
			level: 'info',
			data: context,
		});
	},

	/**
	 * Track export operation
	 */
	async trackExport<T>(
		context: {
			userId: string;
			listId?: string;
			jobId?: string;
			creatorCount: number;
			format: 'csv';
		},
		operation: () => Promise<T>
	): Promise<T> {
		return SentryLogger.startSpanAsync(
			{
				name: 'list.export',
				op: 'export',
				attributes: {
					creatorCount: context.creatorCount,
					format: context.format,
				},
			},
			async () => {
				try {
					const result = await operation();
					SentryLogger.addBreadcrumb({
						category: 'list',
						message: `Export completed: ${context.creatorCount} creators`,
						level: 'info',
						data: context,
					});
					return result;
				} catch (error) {
					SentryLogger.captureException(error, {
						tags: { feature: 'list', operation: 'export' },
						extra: context,
					});
					throw error;
				}
			}
		);
	},
};

// ============================================================================
// API TRACKING
// ============================================================================

export const apiTracker = {
	/**
	 * Track API route execution
	 */
	async trackRoute<T>(route: string, method: string, operation: () => Promise<T>): Promise<T> {
		const startTime = Date.now();

		return SentryLogger.startSpanAsync(
			{
				name: `api.${method.toLowerCase()}.${route}`,
				op: 'http.server',
				attributes: { route, method },
			},
			async () => {
				try {
					const result = await operation();
					const duration = Date.now() - startTime;

					SentryLogger.addBreadcrumb({
						category: 'api',
						message: `${method} ${route} completed`,
						level: 'info',
						data: { duration, status: 'success' },
					});

					return result;
				} catch (error) {
					const duration = Date.now() - startTime;

					SentryLogger.captureException(error, {
						tags: {
							route,
							method,
						},
						extra: { duration },
					});

					throw error;
				}
			}
		);
	},

	/**
	 * Track external API call
	 */
	async trackExternalCall<T>(
		service: string,
		endpoint: string,
		operation: () => Promise<T>
	): Promise<T> {
		const startTime = Date.now();

		return SentryLogger.startSpanAsync(
			{
				name: `external.${service}`,
				op: 'http.client',
				attributes: { service, endpoint },
			},
			async () => {
				try {
					const result = await operation();

					SentryLogger.addBreadcrumb({
						category: 'external_api',
						message: `${service} call completed`,
						level: 'info',
						data: {
							service,
							endpoint,
							duration: Date.now() - startTime,
						},
					});

					return result;
				} catch (error) {
					SentryLogger.captureException(error, {
						tags: {
							feature: 'external_api',
							service,
						},
						extra: {
							endpoint,
							duration: Date.now() - startTime,
						},
					});
					throw error;
				}
			}
		);
	},
};

// ============================================================================
// USER SESSION TRACKING
// ============================================================================

export const sessionTracker = {
	/**
	 * Set up user context for all subsequent events
	 */
	setUser(user: {
		userId: string;
		email?: string;
		firstName?: string;
		lastName?: string;
		plan?: string;
		subscriptionStatus?: string;
		trialEndsAt?: Date;
	}): void {
		SentryLogger.setUser({
			id: user.userId,
			email: user.email,
			username:
				user.firstName && user.lastName
					? `${user.firstName} ${user.lastName}`
					: user.firstName || undefined,
			plan: user.plan,
			subscriptionStatus: user.subscriptionStatus,
		});

		SentryLogger.setContext('subscription', {
			plan: user.plan,
			status: user.subscriptionStatus,
			trialEndsAt: user.trialEndsAt?.toISOString(),
		});
	},

	/**
	 * Clear user context (on logout)
	 */
	clearUser(): void {
		SentryLogger.setUser(null);
		SentryLogger.setContext('subscription', null);
	},
};
