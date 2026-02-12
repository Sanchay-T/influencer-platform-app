'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { PLAN_ORDER } from '@/lib/billing/plan-config';
import type { PlanKey } from '@/lib/types/statuses';
import { type LoggedApiResponse, loggedApiCall } from '@/lib/utils/frontend-logger';
import { isBoolean, isNumber, isString, toRecord } from '@/lib/utils/type-guards';

const BILLING_CACHE_KEY = 'gemz_entitlements_v1';
const CACHE_TTL_MS = 30_000;

type BillingApiRecord = Record<string, unknown>;

type BillingCache = {
	data: BillingApiRecord | null;
	ts: number;
	inflight: Promise<BillingApiRecord> | null;
};

declare global {
	var __BILLING_CACHE__: BillingCache | undefined;
}

const PLAN_HIERARCHY_WITH_FREE: PlanKey[] = ['free', ...PLAN_ORDER];

const normalizeBillingPayload = (input: unknown): BillingApiRecord => toRecord(input) ?? {};

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

const isPlan = (value: string): value is PlanKey =>
	PLAN_HIERARCHY_WITH_FREE.some((plan) => plan === value);

function getPlanFunctions(currentPlan: PlanKey, featureMap: Record<string, boolean>) {
	const currentIndex = PLAN_HIERARCHY_WITH_FREE.indexOf(currentPlan);

	const hasPlan = (required: string): boolean => {
		if (!isPlan(required)) {
			return required === 'free';
		}
		const requiredIndex = PLAN_HIERARCHY_WITH_FREE.indexOf(required);
		return currentIndex >= requiredIndex;
	};

	const canAccessFeature = (feature: string): boolean => {
		if (Object.prototype.hasOwnProperty.call(featureMap, feature)) {
			return Boolean(featureMap[feature]);
		}
		// Fail-safe: unknown features are denied until explicitly added by backend entitlements.
		return false;
	};

	return {
		hasPlan,
		canAccessFeature,
		hasFeature: canAccessFeature,
	};
}

const defaultBillingStatus: BillingStatus = {
	isLoaded: false,
	currentPlan: 'free',
	hasFeature: () => false,
	hasPlan: (plan) => plan === 'free',
	canAccessFeature: () => false,
	isTrialing: false,
	needsUpgrade: false,
	usageInfo: {
		campaignsUsed: 0,
		campaignsLimit: 0,
		creatorsUsed: 0,
		creatorsLimit: 0,
		progressPercentage: 0,
	},
	planFeatures: {
		campaigns: 0,
		creators: 0,
		features: ['trial_access'],
		price: 0,
	},
};

export function useBilling(): BillingStatus {
	const { isLoaded, userId } = useAuth();
	const cacheRef = getBillingCache();
	const [billingStatus, setBillingStatus] = useState<BillingStatus>(defaultBillingStatus);

	const setFromData = useCallback((data: BillingApiRecord) => {
		const currentPlanValue = isString(data.currentPlan) ? data.currentPlan : 'free';
		const currentPlan: PlanKey = isPlan(currentPlanValue) ? currentPlanValue : 'free';
		const isTrialing = isBoolean(data.isTrialing) ? data.isTrialing : false;
		const hasActiveSubscription = isBoolean(data.hasActiveSubscription)
			? data.hasActiveSubscription
			: false;
		const isPaidUser = hasActiveSubscription && currentPlan !== 'free';

		const accessRecord = toRecord(data.access);
		const rawFeatureAccessMap = toRecord(accessRecord?.canAccessFeature) ?? {};
		const featureAccessMap = Object.fromEntries(
			Object.entries(rawFeatureAccessMap).map(([feature, value]) => [feature, Boolean(value)])
		) as Record<string, boolean>;
		const { hasPlan, canAccessFeature, hasFeature } = getPlanFunctions(currentPlan, {
			...featureAccessMap,
		});

		const planFeaturesRecord = toRecord(data.planFeatures);
		const usageInfoRecord = toRecord(data.usageInfo);
		const trialStatusValue = isString(data.trialStatus) ? data.trialStatus : undefined;

		setBillingStatus({
			isLoaded: true,
			currentPlan,
			hasFeature,
			hasPlan,
			canAccessFeature,
			isTrialing,
			hasActiveSubscription,
			isPaidUser,
			needsUpgrade: isBoolean(data.needsUpgrade)
				? data.needsUpgrade
				: !(isPaidUser || isTrialing),
			trialStatus:
				trialStatusValue && isBillingTrialStatus(trialStatusValue)
					? trialStatusValue
					: undefined,
			daysRemaining: isNumber(data.daysRemaining) ? data.daysRemaining : undefined,
			hoursRemaining: isNumber(data.hoursRemaining) ? data.hoursRemaining : undefined,
			minutesRemaining: isNumber(data.minutesRemaining) ? data.minutesRemaining : undefined,
			trialProgressPercentage: isNumber(data.trialProgressPercentage)
				? data.trialProgressPercentage
				: undefined,
			trialStartDate: isString(data.trialStartDate) ? data.trialStartDate : undefined,
			trialEndDate: isString(data.trialEndDate) ? data.trialEndDate : undefined,
			planFeatures: {
				campaigns: isNumber(planFeaturesRecord?.campaigns) ? planFeaturesRecord.campaigns : 0,
				creators: isNumber(planFeaturesRecord?.creators) ? planFeaturesRecord.creators : 0,
				features: Array.isArray(planFeaturesRecord?.features)
					? planFeaturesRecord.features.filter((value): value is string => typeof value === 'string')
					: ['trial_access'],
				price: isNumber(planFeaturesRecord?.price) ? planFeaturesRecord.price : 0,
			},
			usageInfo: {
				campaignsUsed: isNumber(usageInfoRecord?.campaignsUsed) ? usageInfoRecord.campaignsUsed : 0,
				campaignsLimit: isNumber(usageInfoRecord?.campaignsLimit)
					? usageInfoRecord.campaignsLimit
					: 0,
				creatorsUsed: isNumber(usageInfoRecord?.creatorsUsed) ? usageInfoRecord.creatorsUsed : 0,
				creatorsLimit: isNumber(usageInfoRecord?.creatorsLimit)
					? usageInfoRecord.creatorsLimit
					: 0,
				progressPercentage: isNumber(usageInfoRecord?.progressPercentage)
					? usageInfoRecord.progressPercentage
					: 0,
			},
			canManageSubscription: isBoolean(data.canManageSubscription)
				? data.canManageSubscription
				: undefined,
			stripeCustomerId:
				data.stripeCustomerId === null
					? null
					: isString(data.stripeCustomerId)
						? data.stripeCustomerId
						: undefined,
			subscriptionStatus: isString(data.subscriptionStatus) ? data.subscriptionStatus : undefined,
		});
	}, []);

	const setOnError = useCallback(() => {
		setBillingStatus({
			...defaultBillingStatus,
			isLoaded: true,
			needsUpgrade: true,
		});
	}, []);

	const fetchBillingStatus = useCallback(
		async (skipCache = false) => {
			if (!userId) {
				return;
			}

			try {
				try {
					const persisted = localStorage.getItem(BILLING_CACHE_KEY);
					if (persisted) {
						const parsedRecord = toRecord(JSON.parse(persisted));
						const cachedTs = parsedRecord && isNumber(parsedRecord.ts) ? parsedRecord.ts : null;
						const cachedData = parsedRecord ? toRecord(parsedRecord.data) : null;
						if (cachedTs && cachedData && Date.now() - cachedTs < 60_000) {
							setFromData(cachedData);
						}
					}
				} catch {
					// Ignore local cache read failures.
				}

				if (!skipCache && cacheRef.data && Date.now() - cacheRef.ts < CACHE_TTL_MS) {
					setFromData(cacheRef.data);
					return;
				}

				if (cacheRef.inflight) {
					const data = await cacheRef.inflight;
					setFromData(data);
					return;
				}

				cacheRef.inflight = loggedApiCall(
					'/api/billing/entitlements',
					{},
					{ action: 'fetch_billing_entitlements', userId }
				)
					.then(async (res: LoggedApiResponse<unknown>) => {
						if (!res.ok) {
							throw new Error(`Failed to fetch billing entitlements (status ${res.status})`);
						}
						const rawData = res.data ?? (await res.json());
						const data = normalizeBillingPayload(rawData);
						cacheRef.data = data;
						cacheRef.ts = Date.now();
						cacheRef.inflight = null;
						try {
							localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
						} catch {
							// Ignore local cache write failures.
						}
						return data;
					})
					.catch((error: unknown) => {
						cacheRef.inflight = null;
						throw error;
					});

				const data = await cacheRef.inflight;
				setFromData(data);
			} catch (error) {
				setOnError();
				throw error;
			}
		},
		[cacheRef, setFromData, setOnError, userId]
	);

	useEffect(() => {
		if (!(isLoaded && userId)) {
			return;
		}
		fetchBillingStatus().catch(() => undefined);
	}, [fetchBillingStatus, isLoaded, userId]);

	const refreshBillingData = useCallback(() => {
		try {
			localStorage.removeItem(BILLING_CACHE_KEY);
			const cache = getBillingCache();
			cache.data = null;
			cache.ts = 0;
			cache.inflight = null;
		} catch {
			// Ignore cache clearing errors.
		}

		fetchBillingStatus(true).catch(() => undefined);
	}, [fetchBillingStatus]);

	return {
		...billingStatus,
		refreshBillingData,
	};
}

export function clearBillingCache() {
	try {
		localStorage.removeItem(BILLING_CACHE_KEY);
		localStorage.removeItem('gemz_trial_status_v1');
		localStorage.removeItem('gemz_trial_status_cache');
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
