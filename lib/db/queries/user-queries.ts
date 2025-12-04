/**
 * =====================================================
 * USER QUERIES - Database Access Layer
 * Provides backward compatibility for normalized user tables
 * =====================================================
 */

import { and, eq, sql } from 'drizzle-orm';
import { clerkBackendClient } from '@/lib/auth/backend-auth';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
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
			trialStatus: userSubscriptions.trialStatus,
			trialStartDate: userSubscriptions.trialStartDate,
			trialEndDate: userSubscriptions.trialEndDate,
			trialConversionDate: userSubscriptions.trialConversionDate,
			subscriptionCancelDate: userSubscriptions.subscriptionCancelDate,
			subscriptionRenewalDate: userSubscriptions.subscriptionRenewalDate,
			billingSyncStatus: userSubscriptions.billingSyncStatus,

			// Billing data
			stripeCustomerId: userBilling.stripeCustomerId,
			stripeSubscriptionId: userBilling.stripeSubscriptionId,
			paymentMethodId: userBilling.paymentMethodId,
			cardLast4: userBilling.cardLast4,
			cardBrand: userBilling.cardBrand,
			cardExpMonth: userBilling.cardExpMonth,
			cardExpYear: userBilling.cardExpYear,
			billingAddressCity: userBilling.billingAddressCity,
			billingAddressCountry: userBilling.billingAddressCountry,
			billingAddressPostalCode: userBilling.billingAddressPostalCode,

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
		trialStatus: userRecord.trialStatus,
	});

	// Transform to match expected format
	return {
		...userRecord,
		// Ensure required fields have defaults
		currentPlan: userRecord.currentPlan, // NULL = not onboarded yet
		subscriptionStatus: userRecord.subscriptionStatus || 'none',
		trialStatus: userRecord.trialStatus || 'pending',
		billingSyncStatus: userRecord.billingSyncStatus || 'pending',
		planFeatures: userRecord.planFeatures || {},
		usageCampaignsCurrent: userRecord.usageCampaignsCurrent || 0,
		usageCreatorsCurrentMonth: userRecord.usageCreatorsCurrentMonth || 0,
		enrichmentsCurrentMonth: userRecord.enrichmentsCurrentMonth || 0,
		usageResetDate: userRecord.usageResetDate || new Date(),
		signupTimestamp: userRecord.signupTimestamp || userRecord.createdAt,
		emailScheduleStatus: userRecord.emailScheduleStatus || {},
	} as UserProfileComplete;
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
					trialStatus: userData.trialStartDate ? 'active' : 'pending',
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
			return {
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
				trialStatus: newSubscription.trialStatus,
				trialStartDate: newSubscription.trialStartDate,
				trialEndDate: newSubscription.trialEndDate,
				trialConversionDate: newSubscription.trialConversionDate,
				subscriptionCancelDate: newSubscription.subscriptionCancelDate,
				subscriptionRenewalDate: newSubscription.subscriptionRenewalDate,
				billingSyncStatus: newSubscription.billingSyncStatus,

				// Billing data (initially empty)
				stripeCustomerId: null,
				stripeSubscriptionId: null,
				paymentMethodId: null,
				cardLast4: null,
				cardBrand: null,
				cardExpMonth: null,
				cardExpYear: null,
				billingAddressCity: null,
				billingAddressCountry: null,
				billingAddressPostalCode: null,

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
			} as UserProfileComplete;

			info('User created successfully across normalized tables', {
				userId: newUser.userId,
				internalId: newUser.id,
				email: userData.email,
				currentPlan: newSubscription.currentPlan,
				trialStatus: newSubscription.trialStatus,
				onboardingStep: newUser.onboardingStep,
			});
		} catch (transactionError: any) {
			const message = transactionError?.message?.toLowerCase?.() ?? '';
			const duplicate =
				message.includes('duplicate') ||
				message.includes('unique') ||
				transactionError?.code === '23505';

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

	let email: string | undefined;
	let fullName: string | undefined;

	try {
		const clerkUser = await clerkBackendClient.users.getUser(userId);
		email = clerkUser.emailAddresses?.[0]?.emailAddress ?? undefined;
		const clerkFullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
		fullName = clerkFullName || undefined;
	} catch (clerkError) {
		warn('Failed to fetch Clerk metadata during ensureUserProfile', {
			userId,
			errorMessage: clerkError instanceof Error ? clerkError.message : String(clerkError),
		});
	}

	const fallbackEmail = `user-${userId}@example.com`;

	try {
		// Note: currentPlan is intentionally not set here
		// It will be set by Stripe webhook after user completes payment
		const createdProfile = await createUser({
			userId,
			email: email || fallbackEmail,
			fullName: fullName || 'User',
			onboardingStep: 'pending',
			// currentPlan: null - not set until Stripe confirms payment
		});

		info('ensureUserProfile created new record', { userId });
		return createdProfile;
	} catch (createError: any) {
		const message = createError?.message?.toLowerCase?.() ?? '';
		const duplicate =
			message.includes('duplicate') || message.includes('unique') || createError?.code === '23505';

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
		trialStatus?: string;
		trialStartDate?: Date;
		trialEndDate?: Date;
		trialConversionDate?: Date;
		subscriptionCancelDate?: Date;
		subscriptionRenewalDate?: Date;
		billingSyncStatus?: string;

		// Billing updates
		stripeCustomerId?: string;
		stripeSubscriptionId?: string;
		paymentMethodId?: string;
		cardLast4?: string;
		cardBrand?: string;
		cardExpMonth?: number;
		cardExpYear?: number;
		billingAddressCity?: string;
		billingAddressCountry?: string;
		billingAddressPostalCode?: string;

		// Usage updates
		planCampaignsLimit?: number;
		planCreatorsLimit?: number;
		planFeatures?: any;
		usageCampaignsCurrent?: number;
		usageCreatorsCurrentMonth?: number;
		enrichmentsCurrentMonth?: number;
		usageResetDate?: Date;

		// System updates
		emailScheduleStatus?: any;
		lastWebhookEvent?: string;
		lastWebhookTimestamp?: Date;
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
			trialStatus: updates.trialStatus,
			trialStartDate: updates.trialStartDate,
			trialEndDate: updates.trialEndDate,
			trialConversionDate: updates.trialConversionDate,
			subscriptionCancelDate: updates.subscriptionCancelDate,
			subscriptionRenewalDate: updates.subscriptionRenewalDate,
			billingSyncStatus: updates.billingSyncStatus,
		};

		const billingUpdates = {
			stripeCustomerId: updates.stripeCustomerId,
			stripeSubscriptionId: updates.stripeSubscriptionId,
			paymentMethodId: updates.paymentMethodId,
			cardLast4: updates.cardLast4,
			cardBrand: updates.cardBrand,
			cardExpMonth: updates.cardExpMonth,
			cardExpYear: updates.cardExpYear,
			billingAddressCity: updates.billingAddressCity,
			billingAddressCountry: updates.billingAddressCountry,
			billingAddressPostalCode: updates.billingAddressPostalCode,
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

		// Update or insert billing record
		if (Object.values(billingUpdates).some((val) => val !== undefined)) {
			const filteredUpdates = Object.fromEntries(
				Object.entries(billingUpdates).filter(([_, v]) => v !== undefined)
			);
			// Try update first, insert if doesn't exist
			const existingBilling = await tx
				.select({ id: userBilling.id })
				.from(userBilling)
				.where(eq(userBilling.userId, internalUserId));

			if (existingBilling[0]) {
				promises.push(
					tx
						.update(userBilling)
						.set({ ...filteredUpdates, updatedAt: new Date() })
						.where(eq(userBilling.userId, internalUserId))
				);
			} else {
				promises.push(
					tx.insert(userBilling).values({ userId: internalUserId, ...filteredUpdates })
				);
			}
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
			paymentMethodId: userBilling.paymentMethodId,
			cardLast4: userBilling.cardLast4,
			cardBrand: userBilling.cardBrand,
			cardExpMonth: userBilling.cardExpMonth,
			cardExpYear: userBilling.cardExpYear,
			billingAddressCity: userBilling.billingAddressCity,
			billingAddressCountry: userBilling.billingAddressCountry,
			billingAddressPostalCode: userBilling.billingAddressPostalCode,
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

	return (result[0] as UserBilling & { stripeCustomerId: string }) || null;
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
 * Increment user usage counters
 * Specialized function for usage tracking
 */
export async function incrementUsage(
	userId: string,
	type: 'campaigns' | 'creators' | 'enrichments',
	amount: number = 1
): Promise<void> {
	await db
		.update(userUsage)
		.set({
			...(type === 'campaigns'
				? { usageCampaignsCurrent: sql`usage_campaigns_current + ${amount}` }
				: type === 'creators'
					? { usageCreatorsCurrentMonth: sql`usage_creators_current_month + ${amount}` }
					: { enrichmentsCurrentMonth: sql`enrichments_current_month + ${amount}` }),
			updatedAt: new Date(),
		})
		.where(
			eq(userUsage.userId, db.select({ id: users.id }).from(users).where(eq(users.userId, userId)))
		);
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
			trialStatus: userSubscriptions.trialStatus,
			trialStartDate: userSubscriptions.trialStartDate,
			trialEndDate: userSubscriptions.trialEndDate,
			trialConversionDate: userSubscriptions.trialConversionDate,
			subscriptionCancelDate: userSubscriptions.subscriptionCancelDate,
			subscriptionRenewalDate: userSubscriptions.subscriptionRenewalDate,
			billingSyncStatus: userSubscriptions.billingSyncStatus,

			// Billing data
			stripeCustomerId: userBilling.stripeCustomerId,
			stripeSubscriptionId: userBilling.stripeSubscriptionId,
			paymentMethodId: userBilling.paymentMethodId,
			cardLast4: userBilling.cardLast4,
			cardBrand: userBilling.cardBrand,
			cardExpMonth: userBilling.cardExpMonth,
			cardExpYear: userBilling.cardExpYear,
			billingAddressCity: userBilling.billingAddressCity,
			billingAddressCountry: userBilling.billingAddressCountry,
			billingAddressPostalCode: userBilling.billingAddressPostalCode,

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
	return {
		...userRecord,
		// Ensure required fields have defaults
		currentPlan: userRecord.currentPlan, // NULL = not onboarded yet
		subscriptionStatus: userRecord.subscriptionStatus || 'none',
		trialStatus: userRecord.trialStatus || 'pending',
		billingSyncStatus: userRecord.billingSyncStatus || 'pending',
		planFeatures: userRecord.planFeatures || {},
		usageCampaignsCurrent: userRecord.usageCampaignsCurrent || 0,
		usageCreatorsCurrentMonth: userRecord.usageCreatorsCurrentMonth || 0,
		enrichmentsCurrentMonth: userRecord.enrichmentsCurrentMonth || 0,
		usageResetDate: userRecord.usageResetDate || new Date(),
		signupTimestamp: userRecord.signupTimestamp || userRecord.createdAt,
		emailScheduleStatus: userRecord.emailScheduleStatus || {},
	} as UserProfileComplete;
}
