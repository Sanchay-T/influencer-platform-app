'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { structuredConsole } from '@/lib/logging/console-proxy';
import { isValidPlanKey } from '@/lib/types/statuses';
import { type LoggedApiResponse, loggedApiCall, logTiming } from '@/lib/utils/frontend-logger';
import { isBoolean, isNumber, isString, toRecord } from '@/lib/utils/type-guards';
import { buildPlanFns, type PlanKey } from './billing-plan';

const BILLING_DEBUG = false;
const debugLog = (...args: unknown[]) => {
	if (BILLING_DEBUG) {
		structuredConsole.log(...args);
	}
};
const _debugWarn = (...args: unknown[]) => {
	if (BILLING_DEBUG) {
		structuredConsole.warn(...args);
	}
};

const BILLING_CACHE_KEY = 'gemz_entitlements_v1';

type BillingApiRecord = Record<string, unknown>;

type BillingCache = {
	data: BillingApiRecord | null;
	ts: number;
	inflight: Promise<BillingApiRecord> | null;
};

const normalizeBillingPayload = (input: unknown): BillingApiRecord => {
	return toRecord(input) ?? {};
};

declare global {
	var __BILLING_CACHE__: BillingCache | undefined;
}

const getBillingCache = (): BillingCache => {
	if (!globalThis.__BILLING_CACHE__) {
		globalThis.__BILLING_CACHE__ = {
			data: null,
			ts: 0,
			inflight: null,
		};
	}
	return globalThis.__BILLING_CACHE__;
};

export interface BillingStatus {
	isLoaded: boolean;
	currentPlan: PlanKey;
	hasFeature: (feature: string) => boolean;
	hasPlan: (plan: string) => boolean;
	canAccessFeature: (feature: string) => boolean;
	refreshBillingData?: () => void;
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

const isBillingTrialStatus = (value: string): value is NonNullable<BillingStatus['trialStatus']> =>
	value === 'active' || value === 'expired' || value === 'converted' || value === 'cancelled';

/**
 * Custom hook for Stripe-only billing and plan verification
 */
export function useBilling(): BillingStatus {
	const { isLoaded, userId } = useAuth();
	// Simple in-memory cache to avoid duplicate fetches and speed up gating
	// Shared across all hook instances in the same tab
	// Keep data fresh but avoid thrash: 30s TTL + dedupe in-flight
	const CACHE_TTL_MS = 30000;
	const cacheRef = getBillingCache();
	const [billingStatus, setBillingStatus] = useState<BillingStatus>({
		isLoaded: false,
		currentPlan: 'free',
		hasFeature: () => false,
		hasPlan: () => false,
		canAccessFeature: () => false,
		isTrialing: false,
		needsUpgrade: false,
	});

	const setFromData = useCallback((data: BillingApiRecord) => {
		const currentPlanValue = isString(data.currentPlan) ? data.currentPlan : '';
		const currentPlan: PlanKey = isValidPlanKey(currentPlanValue) ? currentPlanValue : 'free';
		const isTrialing = isBoolean(data.isTrialing) ? data.isTrialing : false;
		const hasActiveSubscription = isBoolean(data.hasActiveSubscription)
			? data.hasActiveSubscription
			: false;
		const isPaidUser = hasActiveSubscription && currentPlan !== 'free';
		const { hasPlan, canAccessFeature, hasFeature, planFeatures } = buildPlanFns(currentPlan);

		const usageInfo = toRecord(data.usageInfo);
		const actualCampaignsLimit =
			(isNumber(usageInfo?.campaignsLimit) ? usageInfo?.campaignsLimit : undefined) ??
			planFeatures.campaigns;
		const actualCreatorsLimit =
			(isNumber(usageInfo?.creatorsLimit) ? usageInfo?.creatorsLimit : undefined) ??
			planFeatures.creators;

		const stripeCustomerId =
			data.stripeCustomerId === null
				? null
				: isString(data.stripeCustomerId)
					? data.stripeCustomerId
					: undefined;
		const trialStatusValue = isString(data.trialStatus) ? data.trialStatus : undefined;
		const trialStatus =
			trialStatusValue && isBillingTrialStatus(trialStatusValue) ? trialStatusValue : undefined;

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
			trialStatus,
			daysRemaining: isNumber(data.daysRemaining) ? data.daysRemaining : undefined,
			hoursRemaining: isNumber(data.hoursRemaining) ? data.hoursRemaining : undefined,
			minutesRemaining: isNumber(data.minutesRemaining) ? data.minutesRemaining : undefined,
			trialProgressPercentage: isNumber(data.trialProgressPercentage)
				? data.trialProgressPercentage
				: undefined,
			trialStartDate: isString(data.trialStartDate) ? data.trialStartDate : undefined,
			trialEndDate: isString(data.trialEndDate) ? data.trialEndDate : undefined,
			planFeatures,
			usageInfo: {
				campaignsUsed: isNumber(usageInfo?.campaignsUsed) ? usageInfo.campaignsUsed : 0,
				campaignsLimit: actualCampaignsLimit,
				creatorsUsed: isNumber(usageInfo?.creatorsUsed) ? usageInfo.creatorsUsed : 0,
				creatorsLimit: actualCreatorsLimit,
				progressPercentage: isNumber(usageInfo?.progressPercentage)
					? usageInfo.progressPercentage
					: 0,
			},
			canManageSubscription: isBoolean(data.canManageSubscription)
				? data.canManageSubscription
				: undefined,
			stripeCustomerId,
			subscriptionStatus: isString(data.subscriptionStatus) ? data.subscriptionStatus : undefined,
		});
	}, []);

	const setOnError = useCallback(() => {
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
	}, []);

	// Fetch billing status from our API (with simple cache + inflight guard)
	const fetchBillingStatus = useCallback(
		async (skipCache = false) => {
			if (!userId) {
				return;
			}
			try {
				// 1) Try persisted snapshot first for instant UX (no spinner on refresh)
				try {
					const persisted = localStorage.getItem(BILLING_CACHE_KEY);
					if (persisted) {
						const parsed = JSON.parse(persisted);
						// TTL 60s to keep UI snappy during navigation/refreshes
						const parsedRecord = toRecord(parsed);
						const cachedTs = parsedRecord && isNumber(parsedRecord.ts) ? parsedRecord.ts : null;
						const cachedData = parsedRecord ? toRecord(parsedRecord.data) : null;
						if (cachedTs && cachedData && Date.now() - cachedTs < 60_000) {
							setFromData(cachedData);
						}
					}
				} catch {
					// Ignore localStorage read failures (e.g. privacy mode).
				}

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
					{ action: 'fetch_billing_status', userId }
				)
					.then(async (res: LoggedApiResponse<unknown>) => {
						if (!res.ok) {
							throw new Error(`Failed to fetch billing status (status ${res.status})`);
						}
						const reqId = res.headers.get('x-request-id') || 'none';
						const serverDuration = res.headers.get('x-duration-ms') || 'n/a';
						const rawData = res.data ?? (await res.json());
						const data = normalizeBillingPayload(rawData);
						debugLog('💳 [STRIPE-BILLING] Correlation IDs:', {
							requestId: reqId,
							serverDurationMs: serverDuration,
						});
						logTiming('fetch_billing_status_total', opStart, {
							userId,
							requestId: reqId || undefined,
						});
						cacheRef.data = data;
						cacheRef.ts = Date.now();
						cacheRef.inflight = null;
						// persist snapshot for fast subsequent loads
						try {
							localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
						} catch {
							// Ignore localStorage write failures.
						}
						return data;
					})
					.catch((e: unknown) => {
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
		},
		[cacheRef, setFromData, setOnError, userId]
	);

	useEffect(() => {
		if (!(isLoaded && userId)) {
			return;
		}
		fetchBillingStatus();
	}, [fetchBillingStatus, isLoaded, userId]);

	// Add function to force refresh billing data (useful after upgrades)
	const refreshBillingData = useCallback(() => {
		debugLog('🔄 [BILLING-REFRESH] Force refreshing billing data');

		// Clear caches
		try {
			localStorage.removeItem(BILLING_CACHE_KEY);
			const cache = getBillingCache();
			cache.data = null;
			cache.ts = 0;
			cache.inflight = null;
		} catch (_e) {
			// Ignore cache clearing failures.
		}

		// Trigger a fresh fetch
		fetchBillingStatus(true);
	}, [fetchBillingStatus]);

	return {
		...billingStatus,
		refreshBillingData,
	};
}

// Utility for pages that can't use the hook but need to bust caches (e.g., Stripe return pages)
export function clearBillingCache() {
	try {
		// Clear all billing-related caches
		localStorage.removeItem(BILLING_CACHE_KEY); // gemz_entitlements_v1
		localStorage.removeItem('gemz_trial_status_v1'); // trial-sidebar-compact.tsx
		localStorage.removeItem('gemz_trial_status_cache'); // use-trial-status.ts (blur overlay)
	} catch {
		// Ignore localStorage access issues.
	}
	try {
		const cache = getBillingCache();
		cache.data = null;
		cache.ts = 0;
		cache.inflight = null;
	} catch {
		// Ignore in-memory cache reset failures.
	}
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
