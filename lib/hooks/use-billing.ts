'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { loggedApiCall, logTiming } from '@/lib/utils/frontend-logger';
import { buildPlanFns, type PlanKey } from './billing-plan';

const BILLING_DEBUG = false;
const debugLog = (...args: unknown[]) => {
	if (BILLING_DEBUG) debugLog(...args);
};
const debugWarn = (...args: unknown[]) => {
	if (BILLING_DEBUG) debugWarn(...args);
};

const BILLING_CACHE_KEY = 'gemz_entitlements_v1';

export interface BillingStatus {
	isLoaded: boolean;
	currentPlan: 'free' | 'glow_up' | 'viral_surge' | 'fame_flex';
	hasFeature: (feature: string) => boolean;
	hasPlan: (plan: string) => boolean;
	canAccessFeature: (feature: string) => boolean;
	isTrialing: boolean;
	needsUpgrade: boolean;
	trialStatus?: 'active' | 'expired' | 'converted' | 'cancelled';
	daysRemaining?: number;
	hoursRemaining?: number;
	minutesRemaining?: number;
	trialProgressPercentage?: number;
	trialStartDate?: string;
	trialEndDate?: string;
	hasActiveSubscription?: boolean;
	isPaidUser?: boolean;
	usageInfo?: {
		campaignsUsed: number;
		campaignsLimit: number;
		creatorsUsed: number;
		creatorsLimit: number;
		progressPercentage: number;
	};
	planFeatures?: {
		campaigns: number;
		creators: number;
		features: string[];
		price: number;
	};
	canManageSubscription?: boolean;
	stripeCustomerId?: string | null;
	subscriptionStatus?: string;
}

/**
 * Custom hook for Stripe-only billing and plan verification
 */
export function useBilling(): BillingStatus {
	const { isLoaded, userId } = useAuth();
	// Simple in-memory cache to avoid duplicate fetches and speed up gating
	// Shared across all hook instances in the same tab
	// Keep data fresh but avoid thrash: 30s TTL + dedupe in-flight
	const CACHE_TTL_MS = 30000;
	// @ts-expect-error module-level singleton
	if (!(globalThis as any).__BILLING_CACHE__) {
		(globalThis as any).__BILLING_CACHE__ = {
			data: null as any,
			ts: 0,
			inflight: null as Promise<any> | null,
		};
	}
	const cacheRef = (globalThis as any).__BILLING_CACHE__;
	const [billingStatus, setBillingStatus] = useState<BillingStatus>({
		isLoaded: false,
		currentPlan: 'free',
		hasFeature: () => false,
		hasPlan: () => false,
		canAccessFeature: () => false,
		isTrialing: false,
		needsUpgrade: false,
	});

	useEffect(() => {
		if (!(isLoaded && userId)) return;

		// Fetch billing status from our API (with simple cache + inflight guard)
		const fetchBillingStatus = async (skipCache = false) => {
			try {
				// 1) Try persisted snapshot first for instant UX (no spinner on refresh)
				try {
					const persisted = localStorage.getItem(BILLING_CACHE_KEY);
					if (persisted) {
						const parsed = JSON.parse(persisted);
						// TTL 60s to keep UI snappy during navigation/refreshes
						if (parsed && parsed.ts && Date.now() - parsed.ts < 60_000) {
							setFromData(parsed.data);
						}
					}
				} catch {}

				const now = Date.now();
				if (!skipCache && cacheRef.data && now - cacheRef.ts < CACHE_TTL_MS) {
					setFromData(cacheRef.data);
					return;
				}
				if (cacheRef.inflight) {
					const data = await cacheRef.inflight;
					setFromData(data);
					return;
				}
				const opStart = Date.now();
				debugLog('💳 [STRIPE-BILLING] Fetching billing status for user:', userId);

				cacheRef.inflight = loggedApiCall(
					'/api/billing/status',
					{},
					{ action: 'fetch_billing_status', userId: userId || 'unknown' }
				)
					.then(async (res: any) => {
						if (!res.ok) throw new Error(`Failed to fetch billing status (status ${res.status})`);
						const reqId =
							(res.headers && res.headers.get && res.headers.get('x-request-id')) || 'none';
						const serverDuration =
							(res.headers && res.headers.get && res.headers.get('x-duration-ms')) || 'n/a';
						const data = res.data ?? (await res.json());
						debugLog('💳 [STRIPE-BILLING] Correlation IDs:', {
							requestId: reqId,
							serverDurationMs: serverDuration,
						});
						logTiming('fetch_billing_status_total', opStart, {
							userId: userId || 'unknown',
							requestId: reqId || undefined,
						});
						cacheRef.data = data;
						cacheRef.ts = Date.now();
						cacheRef.inflight = null;
						// persist snapshot for fast subsequent loads
						try {
							localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
						} catch {}
						return data;
					})
					.catch((e: any) => {
						cacheRef.inflight = null;
						throw e;
					});

				const data = await cacheRef.inflight;
				debugLog('💳 [STRIPE-BILLING] Received billing data:', data);

				setFromData(data);
			} catch (error) {
				structuredConsole.error('❌ [STRIPE-BILLING] Error fetching billing status:', error);
				setOnError();
			}
		};

		const setFromData = (data: any) => {
			const currentPlan: PlanKey = data.currentPlan || 'free';
			const isTrialing = data.isTrialing;
			const hasActiveSubscription = data.hasActiveSubscription;
			const isPaidUser = hasActiveSubscription && currentPlan !== 'free';
			const { hasPlan, canAccessFeature, hasFeature, planFeatures } = buildPlanFns(currentPlan);

			const actualCampaignsLimit = data.usageInfo?.campaignsLimit || planFeatures.campaigns;
			const actualCreatorsLimit = data.usageInfo?.creatorsLimit || planFeatures.creators;

			setBillingStatus({
				isLoaded: true,
				currentPlan,
				hasFeature,
				hasPlan,
				canAccessFeature,
				isTrialing,
				hasActiveSubscription,
				isPaidUser,
				needsUpgrade: !isPaidUser,
				trialStatus: data.trialStatus,
				daysRemaining: data.daysRemaining,
				hoursRemaining: data.hoursRemaining,
				minutesRemaining: data.minutesRemaining,
				trialProgressPercentage: data.trialProgressPercentage,
				trialStartDate: data.trialStartDate,
				trialEndDate: data.trialEndDate,
				planFeatures,
				usageInfo: {
					campaignsUsed: data.usageInfo?.campaignsUsed || 0,
					campaignsLimit: actualCampaignsLimit,
					creatorsUsed: data.usageInfo?.creatorsUsed || 0,
					creatorsLimit: actualCreatorsLimit,
					progressPercentage: data.usageInfo?.progressPercentage || 0,
				},
				canManageSubscription: data.canManageSubscription,
				stripeCustomerId: data.stripeCustomerId,
				subscriptionStatus: data.subscriptionStatus,
			});
		};

		const setOnError = () => {
			// Default to free plan on error
			setBillingStatus({
				isLoaded: true,
				currentPlan: 'free',
				hasFeature: () => false,
				hasPlan: (plan) => plan === 'free',
				canAccessFeature: () => false,
				isTrialing: false,
				needsUpgrade: true,
				hasActiveSubscription: false,
				isPaidUser: false,
				trialProgressPercentage: 0,
				hoursRemaining: 0,
				minutesRemaining: 0,
				trialStartDate: undefined,
				trialEndDate: undefined,
				planFeatures: {
					campaigns: 0,
					creators: 0,
					features: ['trial_access'],
					price: 0,
				},
				usageInfo: {
					campaignsUsed: 0,
					campaignsLimit: 0,
					creatorsUsed: 0,
					creatorsLimit: 0,
					progressPercentage: 0,
				},
			});
		};

		fetchBillingStatus();

		// Listen for focus events to refresh billing status
		// Disable focus refresh to avoid thrash; manual refresh still available via refreshBillingData
	}, [isLoaded, userId, cacheRef]);

	// Add function to force refresh billing data (useful after upgrades)
	const refreshBillingData = () => {
		debugLog('🔄 [BILLING-REFRESH] Force refreshing billing data');

		// Clear caches
		try {
			localStorage.removeItem(BILLING_CACHE_KEY);
			if ((globalThis as any).__BILLING_CACHE__) {
				(globalThis as any).__BILLING_CACHE__.data = null;
				(globalThis as any).__BILLING_CACHE__.ts = 0;
				(globalThis as any).__BILLING_CACHE__.inflight = null;
			}
		} catch (e) {}

		// Trigger a fresh fetch
		fetchBillingStatus(true);
	};

	return {
		...billingStatus,
		refreshBillingData,
	};
}

// Utility for pages that can't use the hook but need to bust caches (e.g., Stripe return pages)
export function clearBillingCache() {
	try {
		localStorage.removeItem(BILLING_CACHE_KEY);
	} catch {}
	try {
		if ((globalThis as any).__BILLING_CACHE__) {
			(globalThis as any).__BILLING_CACHE__.data = null;
			(globalThis as any).__BILLING_CACHE__.ts = 0;
			(globalThis as any).__BILLING_CACHE__.inflight = null;
		}
	} catch {}
}

/**
 * Hook for checking specific plan access
 */
export function usePlanAccess(requiredPlan?: string) {
	const { hasPlan, isLoaded } = useBilling();

	if (!requiredPlan) {
		return {
			hasAccess: true,
			isLoaded,
			needsUpgrade: false,
		};
	}

	return {
		hasAccess: hasPlan(requiredPlan),
		isLoaded,
		needsUpgrade: !hasPlan(requiredPlan),
	};
}

/**
 * Hook for checking specific feature access
 */
export function useFeatureAccess(requiredFeature?: string) {
	const { canAccessFeature, isLoaded, currentPlan } = useBilling();

	if (!requiredFeature) {
		return {
			hasAccess: true,
			isLoaded,
			currentPlan,
			needsUpgrade: false,
		};
	}

	return {
		hasAccess: canAccessFeature(requiredFeature),
		isLoaded,
		currentPlan,
		needsUpgrade: !canAccessFeature(requiredFeature),
	};
}
