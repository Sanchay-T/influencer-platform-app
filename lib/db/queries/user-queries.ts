/**
 * =====================================================
 * USER QUERIES - Database Access Layer
 * Provides backward compatibility for normalized user tables
 * =====================================================
 */

import { and, eq, sql } from 'drizzle-orm';
import { clerkBackendClient } from '@/lib/auth/backend-auth';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import { SentryLogger } from '@/lib/logging/sentry-logger';
import { sessionTracker } from '@/lib/sentry/feature-tracking';
import { getNumberProperty, getStringProperty, toRecord } from '@/lib/utils/type-guards';
import { db } from '../index';
import {
	type User,
	type UserBilling,
	type UserProfileComplete,
	type UserSubscription,
	type UserSystemData,
	type UserUsage,
	userBilling,
	userSubscriptions,
	userSystemData,
	users,
	userUsage,
} from '../schema';

export type { UserProfileComplete };

const userQueryLogger = createCategoryLogger(LogCategory.DATABASE);

const toContext = (extra?: Record<string, unknown>) => {
	if (!extra) return undefined;
	const context: { userId?: string; metadata: Record<string, unknown> } = {
		metadata: extra,
	};
	if (typeof extra.userId === 'string') {
		context.userId = extra.userId;
	}
	return context;
};

const debug = (message: string, extra?: Record<string, unknown>) => {
	userQueryLogger.debug(message, toContext(extra));
};

const info = (message: string, extra?: Record<string, unknown>) => {
	userQueryLogger.info(message, toContext(extra));
};

const warn = (message: string, extra?: Record<string, unknown>) => {
	userQueryLogger.warn(message, toContext(extra));
};

const logError = (message: string, err: unknown, extra?: Record<string, unknown>) => {
	const normalized = err instanceof Error ? err : new Error(String(err));
	userQueryLogger.error(message, normalized, toContext(extra));
};

/**
 * Get complete user profile (replaces old userProfiles queries)
 * This function provides backward compatibility by joining all normalized tables
 */
export async function getUserProfile(userId: string): Promise<UserProfileComplete | null> {
	debug('getUserProfile invoked', { userId });
	debug('Executing normalized user profile query');

	const result = await db
		.select({
			// Core user data
			id: users.id,
			userId: users.userId,
			email: users.email,
			fullName: users.fullName,
			businessName: users.businessName,
			brandDescription: users.brandDescription,
			industry: users.industry,
			onboardingStep: users.onboardingStep,
			isAdmin: users.isAdmin,
			createdAt: users.createdAt,
			updatedAt: users.updatedAt,

			// Subscription data
			currentPlan: userSubscriptions.currentPlan,
			intendedPlan: userSubscriptions.intendedPlan,
			subscriptionStatus: userSubscriptions.subscriptionStatus,
			// trialStatus removed - derive via deriveTrialStatus()
			trialStartDate: userSubscriptions.trialStartDate,
			trialEndDate: userSubscriptions.trialEndDate,
			subscriptionCancelDate: userSubscriptions.subscriptionCancelDate,
			billingSyncStatus: userSubscriptions.billingSyncStatus,

			// Billing data (minimal - Stripe Portal handles card/address)
			stripeCustomerId: userBilling.stripeCustomerId,
			stripeSubscriptionId: userBilling.stripeSubscriptionId,

			// Usage data
			planCampaignsLimit: userUsage.planCampaignsLimit,
			planCreatorsLimit: userUsage.planCreatorsLimit,
			planFeatures: userUsage.planFeatures,
			usageCampaignsCurrent: userUsage.usageCampaignsCurrent,
			usageCreatorsCurrentMonth: userUsage.usageCreatorsCurrentMonth,
			enrichmentsCurrentMonth: userUsage.enrichmentsCurrentMonth,
			usageResetDate: userUsage.usageResetDate,

			// System data
			signupTimestamp: userSystemData.signupTimestamp,
			emailScheduleStatus: userSystemData.emailScheduleStatus,
			lastWebhookEvent: userSystemData.lastWebhookEvent,
			lastWebhookTimestamp: userSystemData.lastWebhookTimestamp,
		})
		.from(users)
		.leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
		.leftJoin(userBilling, eq(users.id, userBilling.userId))
		.leftJoin(userUsage, eq(users.id, userUsage.userId))
		.leftJoin(userSystemData, eq(users.id, userSystemData.userId))
		.where(eq(users.userId, userId));

	debug('User profile query completed', { resultCount: result.length, userId });

	const userRecord = result[0];

	if (!userRecord) {
		warn('No normalized user record found', { userId });
		return null;
	}

	if (!userRecord.id) {
		warn('User record missing internal id', { userId, record: userRecord });
		return null;
	}

	info('Normalized user record resolved', {
		id: userRecord.id,
		userId: userRecord.userId,
		email: userRecord.email,
		currentPlan: userRecord.currentPlan,
		onboardingStep: userRecord.onboardingStep,
	});

	// Transform to match expected format
	const profile: UserProfileComplete = {
		...userRecord,
		// Ensure required fields have defaults
		currentPlan: userRecord.currentPlan, // NULL = not onboarded yet
		subscriptionStatus: userRecord.subscriptionStatus || 'none',
		// trialStatus removed - derive via deriveTrialStatus()
		billingSyncStatus: userRecord.billingSyncStatus || 'pending',
		planFeatures: userRecord.planFeatures || {},
		usageCampaignsCurrent: userRecord.usageCampaignsCurrent || 0,
		usageCreatorsCurrentMonth: userRecord.usageCreatorsCurrentMonth || 0,
		enrichmentsCurrentMonth: userRecord.enrichmentsCurrentMonth || 0,
		usageResetDate: userRecord.usageResetDate || new Date(),
		signupTimestamp: userRecord.signupTimestamp || userRecord.createdAt,
		emailScheduleStatus: userRecord.emailScheduleStatus || {},
	};

	// Set Sentry user context for better error tracking
	// Include trialEndDate to track trial status in error reports
	sessionTracker.setUser({
		userId: profile.userId,
		email: profile.email || undefined,
		plan: profile.currentPlan || undefined,
		subscriptionStatus: profile.subscriptionStatus || undefined,
		trialEndsAt: profile.trialEndDate || undefined,
	});

	return profile;
}

/**
 * Create new user with all related records
 * Replaces user_profiles INSERT operations
 */
export async function createUser(userData: {
	userId: string;
	email?: string;
	fullName?: string;
	businessName?: string;
	brandDescription?: string;
	industry?: string;
	onboardingStep?: string;
	trialStartDate?: Date;
	trialEndDate?: Date;
	currentPlan?: string;
	intendedPlan?: string;
}): Promise<UserProfileComplete> {
	info('createUser invoked', {
		userId: userData.userId,
		email: userData.email,
		fullName: userData.fullName,
		onboardingStep: userData.onboardingStep || 'pending',
		currentPlan: userData.currentPlan || null, // NULL until Stripe confirms payment
		hasTrialStart: !!userData.trialStartDate,
		hasTrialEnd: !!userData.trialEndDate,
	});

	return db.transaction(async (tx) => {
		debug('Starting database transaction for user creation', { userId: userData.userId });

		try {
			// 1. Insert core user data
			const [newUser] = await tx
				.insert(users)
				.values({
					userId: userData.userId,
					email: userData.email,
					fullName: userData.fullName,
					businessName: userData.businessName,
					brandDescription: userData.brandDescription,
					industry: userData.industry,
					onboardingStep: userData.onboardingStep || 'pending',
				})
				.returning();

			// 2. Insert subscription data
			// Note: currentPlan is NULL until Stripe webhook confirms payment
			const [newSubscription] = await tx
				.insert(userSubscriptions)
				.values({
					userId: newUser.id,
					currentPlan: userData.currentPlan || null, // NULL = hasn't completed onboarding
					intendedPlan: userData.intendedPlan,
					// trialStatus removed - now derived from subscriptionStatus + trialEndDate
					trialStartDate: userData.trialStartDate,
					trialEndDate: userData.trialEndDate,
				})
				.returning();

			// 3. Insert usage tracking
			const [newUsage] = await tx
				.insert(userUsage)
				.values({
					userId: newUser.id,
					planFeatures: {},
					usageCampaignsCurrent: 0,
					usageCreatorsCurrentMonth: 0,
					enrichmentsCurrentMonth: 0,
				})
				.returning();

			// 4. Insert system data
			const [newSystemData] = await tx
				.insert(userSystemData)
				.values({
					userId: newUser.id,
					emailScheduleStatus: {},
				})
				.returning();

			// Return combined profile
			const profile: UserProfileComplete = {
				// Core user data
				id: newUser.id,
				userId: newUser.userId,
				email: newUser.email,
				fullName: newUser.fullName,
				businessName: newUser.businessName,
				brandDescription: newUser.brandDescription,
				industry: newUser.industry,
				onboardingStep: newUser.onboardingStep,
				isAdmin: newUser.isAdmin,
				createdAt: newUser.createdAt,
				updatedAt: newUser.updatedAt,

				// Subscription data
				currentPlan: newSubscription.currentPlan,
				intendedPlan: newSubscription.intendedPlan,
				subscriptionStatus: newSubscription.subscriptionStatus,
				// trialStatus removed - derive via deriveTrialStatus()
				trialStartDate: newSubscription.trialStartDate,
				trialEndDate: newSubscription.trialEndDate,
				subscriptionCancelDate: newSubscription.subscriptionCancelDate,
				billingSyncStatus: newSubscription.billingSyncStatus,

				// Billing data (initially empty)
				stripeCustomerId: null,
				stripeSubscriptionId: null,

				// Usage data
				planCampaignsLimit: newUsage.planCampaignsLimit,
				planCreatorsLimit: newUsage.planCreatorsLimit,
				planFeatures: newUsage.planFeatures,
				usageCampaignsCurrent: newUsage.usageCampaignsCurrent,
				usageCreatorsCurrentMonth: newUsage.usageCreatorsCurrentMonth,
				enrichmentsCurrentMonth: newUsage.enrichmentsCurrentMonth,
				usageResetDate: newUsage.usageResetDate,

				// System data
				signupTimestamp: newSystemData.signupTimestamp,
				emailScheduleStatus: newSystemData.emailScheduleStatus,
				lastWebhookEvent: newSystemData.lastWebhookEvent,
				lastWebhookTimestamp: newSystemData.lastWebhookTimestamp,
			};
			return profile;

			info('User created successfully across normalized tables', {
				userId: newUser.userId,
				internalId: newUser.id,
				email: userData.email,
				currentPlan: newSubscription.currentPlan,
				// trialStatus removed - derive via deriveTrialStatus()
				onboardingStep: newUser.onboardingStep,
			});
		} catch (transactionError: unknown) {
			const errorRecord = toRecord(transactionError);
			const message = errorRecord ? getStringProperty(errorRecord, 'message') : null;
			const code = errorRecord ? getStringProperty(errorRecord, 'code') : null;
			const numericCode = errorRecord ? getNumberProperty(errorRecord, 'code') : null;
			const lowerMessage = message ? message.toLowerCase() : '';
			const duplicate =
				lowerMessage.includes('duplicate') ||
				lowerMessage.includes('unique') ||
				code === '23505' ||
				numericCode === 23505;

			if (duplicate) {
				warn('User creation detected duplicate userId, returning existing profile', {
					userId: userData.userId,
				});
				const existing = await getUserProfile(userData.userId);
				if (existing) return existing;
			}

			logError('User creation transaction failed', transactionError, { userId: userData.userId });
			throw transactionError;
		}
	});
}

export async function ensureUserProfile(userId: string): Promise<UserProfileComplete> {
	const existingProfile = await getUserProfile(userId);
	if (existingProfile) {
		debug('ensureUserProfile resolved existing record', { userId });
		return existingProfile;
	}

	info('ensureUserProfile creating normalized profile', { userId });

	// Get user data from Clerk - this is required, no fallback
	const clerk = await clerkBackendClient();
	const clerkUser = await clerk.users.getUser(userId);
	const email = clerkUser.emailAddresses?.[0]?.emailAddress;
	const fullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined;

	if (!email) {
		// This should never happen - Clerk users always have email
		throw new Error(`Clerk user ${userId} has no email address`);
	}

	try {
		// Note: currentPlan is intentionally not set here
		// It will be set by Stripe webhook after user completes payment
		const createdProfile = await createUser({
			userId,
			email,
			fullName: fullName || 'User',
			onboardingStep: 'pending',
			// currentPlan: null - not set until Stripe confirms payment
		});

		info('ensureUserProfile created new record', { userId });
		return createdProfile;
	} catch (createError: unknown) {
		const errorRecord = toRecord(createError);
		const message = errorRecord ? getStringProperty(errorRecord, 'message') : null;
		const code = errorRecord ? getStringProperty(errorRecord, 'code') : null;
		const numericCode = errorRecord ? getNumberProperty(errorRecord, 'code') : null;
		const lowerMessage = message ? message.toLowerCase() : '';
		const duplicate =
			lowerMessage.includes('duplicate') ||
			lowerMessage.includes('unique') ||
			code === '23505' ||
			numericCode === 23505;

		if (duplicate) {
			warn('ensureUserProfile detected concurrent creation, refetching', { userId });
			const profile = await getUserProfile(userId);
			if (profile) {
				return profile;
			}
		}

		logError('ensureUserProfile failed to create user', createError, { userId });
		throw createError;
	}
}

/**
 * Update user profile across normalized tables
 * Replaces user_profiles UPDATE operations
 */
export async function updateUserProfile(
	userId: string,
	updates: {
		// Core user updates
		email?: string;
		fullName?: string;
		businessName?: string;
		brandDescription?: string;
		industry?: string;
		onboardingStep?: string;
		isAdmin?: boolean;

		// Subscription updates
		currentPlan?: string;
		intendedPlan?: string;
		subscriptionStatus?: string;
		// trialStatus removed - now derived
		trialStartDate?: Date;
		trialEndDate?: Date;
		subscriptionCancelDate?: Date;
		billingSyncStatus?: string;

		// Billing updates (minimal - Stripe Portal handles card/address)
		stripeCustomerId?: string | null;
		stripeSubscriptionId?: string | null;

		// Usage updates
		planCampaignsLimit?: number;
		planCreatorsLimit?: number;
		planFeatures?: unknown;
		usageCampaignsCurrent?: number;
		usageCreatorsCurrentMonth?: number;
		enrichmentsCurrentMonth?: number;
		usageResetDate?: Date;

		// System updates
		emailScheduleStatus?: unknown;
		lastWebhookEvent?: string | null;
		lastWebhookTimestamp?: Date | null;
	}
): Promise<void> {
	return db.transaction(async (tx) => {
		// Get user internal ID
		const userRecord = await tx
			.select({ id: users.id })
			.from(users)
			.where(eq(users.userId, userId));

		if (!userRecord[0]) {
			throw new Error(`User not found: ${userId}`);
		}

		const internalUserId = userRecord[0].id;

		// Split updates by table
		const userUpdates = {
			email: updates.email,
			fullName: updates.fullName,
			businessName: updates.businessName,
			brandDescription: updates.brandDescription,
			industry: updates.industry,
			onboardingStep: updates.onboardingStep,
			isAdmin: updates.isAdmin,
		};

		const subscriptionUpdates = {
			currentPlan: updates.currentPlan,
			intendedPlan: updates.intendedPlan,
			subscriptionStatus: updates.subscriptionStatus,
			// trialStatus removed - now derived
			trialStartDate: updates.trialStartDate,
			trialEndDate: updates.trialEndDate,
			subscriptionCancelDate: updates.subscriptionCancelDate,
			billingSyncStatus: updates.billingSyncStatus,
		};

		const billingUpdates = {
			stripeCustomerId: updates.stripeCustomerId,
			stripeSubscriptionId: updates.stripeSubscriptionId,
		};

		const usageUpdates = {
			planCampaignsLimit: updates.planCampaignsLimit,
			planCreatorsLimit: updates.planCreatorsLimit,
			planFeatures: updates.planFeatures,
			usageCampaignsCurrent: updates.usageCampaignsCurrent,
			usageCreatorsCurrentMonth: updates.usageCreatorsCurrentMonth,
			enrichmentsCurrentMonth: updates.enrichmentsCurrentMonth,
			usageResetDate: updates.usageResetDate,
		};

		const systemUpdates = {
			emailScheduleStatus: updates.emailScheduleStatus,
			lastWebhookEvent: updates.lastWebhookEvent,
			lastWebhookTimestamp: updates.lastWebhookTimestamp,
		};

		// Apply updates to appropriate tables
		const promises = [];

		// Update users table
		if (Object.values(userUpdates).some((val) => val !== undefined)) {
			const filteredUpdates = Object.fromEntries(
				Object.entries(userUpdates).filter(([_, v]) => v !== undefined)
			);
			promises.push(
				tx
					.update(users)
					.set({ ...filteredUpdates, updatedAt: new Date() })
					.where(eq(users.userId, userId))
			);
		}

		// Update or insert subscription record
		if (Object.values(subscriptionUpdates).some((val) => val !== undefined)) {
			const filteredUpdates = Object.fromEntries(
				Object.entries(subscriptionUpdates).filter(([_, v]) => v !== undefined)
			);
			promises.push(
				tx
					.update(userSubscriptions)
					.set({ ...filteredUpdates, updatedAt: new Date() })
					.where(eq(userSubscriptions.userId, internalUserId))
			);
		}

		// Update or insert billing record using UPSERT (atomic operation)
		// This prevents race conditions when concurrent webhooks try to insert/update
		if (Object.values(billingUpdates).some((val) => val !== undefined)) {
			const filteredUpdates = Object.fromEntries(
				Object.entries(billingUpdates).filter(([_, v]) => v !== undefined)
			);

			// Use upsert to atomically insert or update
			// This prevents the race condition where two webhooks both see no record
			// and both try to insert, causing a unique constraint violation
			promises.push(
				tx
					.insert(userBilling)
					.values({ userId: internalUserId, ...filteredUpdates })
					.onConflictDoUpdate({
						target: userBilling.userId,
						set: { ...filteredUpdates, updatedAt: new Date() },
					})
			);
		}

		// Update usage record
		if (Object.values(usageUpdates).some((val) => val !== undefined)) {
			const filteredUpdates = Object.fromEntries(
				Object.entries(usageUpdates).filter(([_, v]) => v !== undefined)
			);
			promises.push(
				tx
					.update(userUsage)
					.set({ ...filteredUpdates, updatedAt: new Date() })
					.where(eq(userUsage.userId, internalUserId))
			);
		}

		// Update system data
		if (Object.values(systemUpdates).some((val) => val !== undefined)) {
			const filteredUpdates = Object.fromEntries(
				Object.entries(systemUpdates).filter(([_, v]) => v !== undefined)
			);
			promises.push(
				tx
					.update(userSystemData)
					.set({ ...filteredUpdates, updatedAt: new Date() })
					.where(eq(userSystemData.userId, internalUserId))
			);
		}

		await Promise.all(promises);
	});
}

/**
 * Get user billing info only
 * Optimized query for billing-specific operations
 */
export async function getUserBilling(
	userId: string
): Promise<(UserBilling & { stripeCustomerId: string }) | null> {
	const result = await db
		.select({
			id: userBilling.id,
			userId: userBilling.userId,
			stripeCustomerId: userBilling.stripeCustomerId,
			stripeSubscriptionId: userBilling.stripeSubscriptionId,
			createdAt: userBilling.createdAt,
			updatedAt: userBilling.updatedAt,
		})
		.from(userBilling)
		.innerJoin(users, eq(users.id, userBilling.userId))
		.where(
			and(
				eq(users.userId, userId),
				// Only return records with Stripe customer ID
				eq(userBilling.stripeCustomerId, userBilling.stripeCustomerId)
			)
		);

	const record = result[0];
	if (!record || typeof record.stripeCustomerId !== 'string') {
		return null;
	}
	return {
		...record,
		stripeCustomerId: record.stripeCustomerId,
	};
}

/**
 * Get user usage info only
 * Optimized query for usage tracking operations
 */
export async function getUserUsage(userId: string): Promise<UserUsage | null> {
	const result = await db
		.select()
		.from(userUsage)
		.innerJoin(users, eq(users.id, userUsage.userId))
		.where(eq(users.userId, userId));

	return result[0]?.user_usage || null;
}

/**
 * Find user by Stripe customer ID
 * Used primarily by Stripe webhooks
 */
export async function getUserByStripeCustomerId(
	stripeCustomerId: string
): Promise<UserProfileComplete | null> {
	const result = await db
		.select({
			// Core user data
			id: users.id,
			userId: users.userId,
			email: users.email,
			fullName: users.fullName,
			businessName: users.businessName,
			brandDescription: users.brandDescription,
			industry: users.industry,
			onboardingStep: users.onboardingStep,
			isAdmin: users.isAdmin,
			createdAt: users.createdAt,
			updatedAt: users.updatedAt,

			// Subscription data
			currentPlan: userSubscriptions.currentPlan,
			intendedPlan: userSubscriptions.intendedPlan,
			subscriptionStatus: userSubscriptions.subscriptionStatus,
			// trialStatus removed - derive via deriveTrialStatus()
			trialStartDate: userSubscriptions.trialStartDate,
			trialEndDate: userSubscriptions.trialEndDate,
			subscriptionCancelDate: userSubscriptions.subscriptionCancelDate,
			billingSyncStatus: userSubscriptions.billingSyncStatus,

			// Billing data (minimal - Stripe Portal handles card/address)
			stripeCustomerId: userBilling.stripeCustomerId,
			stripeSubscriptionId: userBilling.stripeSubscriptionId,

			// Usage data
			planCampaignsLimit: userUsage.planCampaignsLimit,
			planCreatorsLimit: userUsage.planCreatorsLimit,
			planFeatures: userUsage.planFeatures,
			usageCampaignsCurrent: userUsage.usageCampaignsCurrent,
			usageCreatorsCurrentMonth: userUsage.usageCreatorsCurrentMonth,
			enrichmentsCurrentMonth: userUsage.enrichmentsCurrentMonth,
			usageResetDate: userUsage.usageResetDate,

			// System data
			signupTimestamp: userSystemData.signupTimestamp,
			emailScheduleStatus: userSystemData.emailScheduleStatus,
			lastWebhookEvent: userSystemData.lastWebhookEvent,
			lastWebhookTimestamp: userSystemData.lastWebhookTimestamp,
		})
		.from(userBilling)
		.innerJoin(users, eq(users.id, userBilling.userId))
		.leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
		.leftJoin(userUsage, eq(users.id, userUsage.userId))
		.leftJoin(userSystemData, eq(users.id, userSystemData.userId))
		.where(eq(userBilling.stripeCustomerId, stripeCustomerId));

	const userRecord = result[0];

	if (!(userRecord && userRecord.id)) {
		return null;
	}

	// Transform to match expected format
	const profile: UserProfileComplete = {
		...userRecord,
		// Ensure required fields have defaults
		currentPlan: userRecord.currentPlan, // NULL = not onboarded yet
		subscriptionStatus: userRecord.subscriptionStatus || 'none',
		// trialStatus removed - derive via deriveTrialStatus()
		billingSyncStatus: userRecord.billingSyncStatus || 'pending',
		planFeatures: userRecord.planFeatures || {},
		usageCampaignsCurrent: userRecord.usageCampaignsCurrent || 0,
		usageCreatorsCurrentMonth: userRecord.usageCreatorsCurrentMonth || 0,
		enrichmentsCurrentMonth: userRecord.enrichmentsCurrentMonth || 0,
		usageResetDate: userRecord.usageResetDate || new Date(),
		signupTimestamp: userRecord.signupTimestamp || userRecord.createdAt,
		emailScheduleStatus: userRecord.emailScheduleStatus || {},
	};
	return profile;
}
