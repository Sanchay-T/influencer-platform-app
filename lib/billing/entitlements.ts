/**
 * ═══════════════════════════════════════════════════════════════
 * BILLING ENTITLEMENTS - Canonical Access Surface for UI + APIs
 * ═══════════════════════════════════════════════════════════════
 *
 * This module derives a single, server-truth entitlement payload that can be
 * consumed by frontend gates and backend endpoints.
 *
 * @why Removes duplicated plan/gating logic from clients.
 */

import { getUsageSummary } from './usage-tracking';
import { getBillingStatus } from './billing-status';
import {
	getTrialSearchStatus,
	validateCampaignCreation,
	validateCreatorSearch,
	validateEnrichment,
} from './access-validation';
import { getPlanConfig, isValidPlan, PLAN_ORDER, type PlanKey } from './plan-config';

export type ClientPlanKey = 'free' | PlanKey;

const PLAN_HIERARCHY_WITH_FREE: ClientPlanKey[] = ['free', ...PLAN_ORDER];

function toClientPlanKey(plan: string | null | undefined): ClientPlanKey {
	if (plan && isValidPlan(plan)) {
		return plan;
	}
	return 'free';
}

function hasPlanAccess(currentPlan: ClientPlanKey, requiredPlan: ClientPlanKey): boolean {
	const currentIndex = PLAN_HIERARCHY_WITH_FREE.indexOf(currentPlan);
	const requiredIndex = PLAN_HIERARCHY_WITH_FREE.indexOf(requiredPlan);

	if (currentIndex < 0 || requiredIndex < 0) {
		return false;
	}

	return currentIndex >= requiredIndex;
}

function getFeatureMatrix(currentPlan: ClientPlanKey) {
	if (currentPlan === 'free') {
		return {
			csv_export: false,
			advanced_analytics: false,
			api_access: false,
			priority_support: false,
			realtime_updates: false,
			bio_extraction: false,
		};
	}

	const planConfig = getPlanConfig(currentPlan);
	return {
		csv_export: planConfig.features.csvExport,
		advanced_analytics: planConfig.features.analytics === 'advanced',
		api_access: planConfig.features.apiAccess,
		priority_support: planConfig.features.prioritySupport,
		realtime_updates: planConfig.features.realtimeUpdates,
		bio_extraction: true,
	};
}

export interface BillingEntitlements {
	userId: string;
	currentPlan: ClientPlanKey;
	subscriptionStatus: string;
	trialStatus: 'pending' | 'active' | 'expired' | 'converted' | 'cancelled';
	daysRemaining: number;
	hoursRemaining: number;
	minutesRemaining: number;
	trialProgressPercentage: number;
	trialStartDate?: string;
	trialEndDate?: string;
	isTrialing: boolean;
	hasActiveSubscription: boolean;
	isPaidUser: boolean;
	needsUpgrade: boolean;
	canManageSubscription: boolean;
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
	planFeatures: {
		campaigns: number;
		creators: number;
		enrichments: number;
		features: string[];
		price: number;
	};
	usageInfo: {
		campaignsUsed: number;
		campaignsLimit: number;
		creatorsUsed: number;
		creatorsLimit: number;
		enrichmentsUsed: number;
		enrichmentsLimit: number;
		progressPercentage: number;
	};
	trialSearch: {
		isTrialUser: boolean;
		searchesUsed: number;
		searchesRemaining: number;
		searchesLimit: number;
	};
	access: {
		canCreateCampaign: boolean;
		canSearchCreators: boolean;
		canEnrichCreators: boolean;
		canAccessFeature: Record<string, boolean>;
	};
	reasons: {
		campaign?: string;
		search?: string;
		enrichment?: string;
	};
	lastSyncTime: string;
}

export async function getBillingEntitlements(userId: string): Promise<BillingEntitlements> {
	const [billingStatus, usageSummary, trialSearchStatus, campaignAccess, searchAccess, enrichmentAccess] =
		await Promise.all([
			getBillingStatus(userId),
			getUsageSummary(userId),
			getTrialSearchStatus(userId),
			validateCampaignCreation(userId),
			validateCreatorSearch(userId, 1),
			validateEnrichment(userId, 1),
		]);

	const currentPlan = toClientPlanKey(billingStatus.currentPlan);
	const featureMatrix = getFeatureMatrix(currentPlan);
	const planConfig = currentPlan === 'free' ? null : getPlanConfig(currentPlan);
	const hasActiveSubscription = billingStatus.hasActiveSubscription;
	const isTrialing = billingStatus.isTrialing;
	const isPaidUser = hasActiveSubscription && currentPlan !== 'free';

	const planFeatures =
		currentPlan === 'free' || !planConfig
			? {
					campaigns: 0,
					creators: 0,
					enrichments: 0,
					features: ['trial_access'],
					price: 0,
				}
			: {
					campaigns: planConfig.limits.campaigns,
					creators: planConfig.limits.creatorsPerMonth,
					enrichments: planConfig.limits.enrichmentsPerMonth,
					features: Object.entries(featureMatrix)
						.filter(([, enabled]) => enabled)
						.map(([feature]) => feature),
					price: Math.round(planConfig.monthlyPrice / 100),
				};

	const usageInfo = {
		campaignsUsed: usageSummary?.campaigns.used ?? billingStatus.usageInfo?.campaignsUsed ?? 0,
		campaignsLimit: usageSummary?.campaigns.limit ?? billingStatus.usageInfo?.campaignsLimit ?? 0,
		creatorsUsed:
			usageSummary?.creatorsThisMonth.used ?? billingStatus.usageInfo?.creatorsUsed ?? 0,
		creatorsLimit:
			usageSummary?.creatorsThisMonth.limit ?? billingStatus.usageInfo?.creatorsLimit ?? 0,
		enrichmentsUsed: usageSummary?.enrichmentsThisMonth.used ?? 0,
		enrichmentsLimit: usageSummary?.enrichmentsThisMonth.limit ?? 0,
		progressPercentage: billingStatus.usageInfo?.progressPercentage ?? 0,
	};

	const featureAccessMap: Record<string, boolean> = {
		csv_export: featureMatrix.csv_export && (hasActiveSubscription || isTrialing),
		advanced_analytics: featureMatrix.advanced_analytics && (hasActiveSubscription || isTrialing),
		api_access: featureMatrix.api_access && hasActiveSubscription,
		priority_support: featureMatrix.priority_support && hasActiveSubscription,
		realtime_updates: featureMatrix.realtime_updates && (hasActiveSubscription || isTrialing),
		bio_extraction: featureMatrix.bio_extraction && (hasActiveSubscription || isTrialing),
		instagram_search: hasPlanAccess(currentPlan, 'growth') && (hasActiveSubscription || isTrialing),
		youtube_search: hasPlanAccess(currentPlan, 'growth') && (hasActiveSubscription || isTrialing),
		unlimited_search: hasPlanAccess(currentPlan, 'growth') && (hasActiveSubscription || isTrialing),
	};

	const canCreateCampaign = campaignAccess.allowed;
	const canSearchCreators = searchAccess.allowed;
	const canEnrichCreators = enrichmentAccess.allowed;

	return {
		userId,
		currentPlan,
		subscriptionStatus: billingStatus.subscriptionStatus,
		trialStatus: billingStatus.trialStatus,
		daysRemaining: billingStatus.daysRemaining,
		hoursRemaining: billingStatus.hoursRemaining,
		minutesRemaining: billingStatus.minutesRemaining,
		trialProgressPercentage: billingStatus.trialProgressPercentage,
		trialStartDate: billingStatus.trialStartDate,
		trialEndDate: billingStatus.trialEndDate,
		isTrialing,
		hasActiveSubscription,
		isPaidUser,
		needsUpgrade: !(isPaidUser || isTrialing),
		canManageSubscription: billingStatus.canManageSubscription,
		stripeCustomerId: billingStatus.stripeCustomerId,
		stripeSubscriptionId: billingStatus.stripeSubscriptionId,
		planFeatures,
		usageInfo,
		trialSearch: {
			isTrialUser: trialSearchStatus?.isTrialUser ?? false,
			searchesUsed: trialSearchStatus?.searchesUsed ?? 0,
			searchesRemaining: trialSearchStatus?.searchesRemaining ?? 3,
			searchesLimit: trialSearchStatus?.searchesLimit ?? 3,
		},
		access: {
			canCreateCampaign,
			canSearchCreators,
			canEnrichCreators,
			canAccessFeature: featureAccessMap,
		},
		reasons: {
			campaign: campaignAccess.reason,
			search: searchAccess.reason,
			enrichment: enrichmentAccess.reason,
		},
		lastSyncTime: new Date().toISOString(),
	};
}
