/**
 * =====================================================
 * USER QUERIES - Database Access Layer
 * Provides backward compatibility for normalized user tables
 * =====================================================
 */

import { db } from '../index';
import { 
  users, 
  userSubscriptions, 
  userBilling, 
  userUsage, 
  userSystemData,
  type UserProfileComplete,
  type User,
  type UserSubscription,
  type UserBilling,
  type UserUsage,
  type UserSystemData
} from '../schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Get complete user profile (replaces old userProfiles queries)
 * This function provides backward compatibility by joining all normalized tables
 */
export async function getUserProfile(userId: string): Promise<UserProfileComplete | null> {
  console.log(`🔍 [USER-QUERIES] getUserProfile called for userId: ${userId}`);
  console.log(`🔍 [USER-QUERIES] Starting normalized database query with JOIN across 5 tables`);
  
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
    
  console.log(`🔍 [USER-QUERIES] Database query completed. Result count: ${result.length}`);
  
  const userRecord = result[0];
  
  if (!userRecord) {
    console.log(`❌ [USER-QUERIES] No user record found - user does not exist in normalized database`);
    console.log(`❌ [USER-QUERIES] This means: user needs to be created via Clerk webhook or signup process`);
    return null;
  }
  
  if (!userRecord.id) {
    console.log(`❌ [USER-QUERIES] User record found but missing ID - data integrity issue`);
    console.log(`❌ [USER-QUERIES] User record:`, userRecord);
    return null;
  }
  
  console.log(`✅ [USER-QUERIES] User found in normalized database:`, {
    id: userRecord.id,
    userId: userRecord.userId,
    email: userRecord.email,
    currentPlan: userRecord.currentPlan,
    onboardingStep: userRecord.onboardingStep,
    trialStatus: userRecord.trialStatus
  });
  
  // Transform to match expected format
  return {
    ...userRecord,
    // Ensure required fields have defaults
    currentPlan: userRecord.currentPlan || 'free',
    subscriptionStatus: userRecord.subscriptionStatus || 'none',
    trialStatus: userRecord.trialStatus || 'pending',
    billingSyncStatus: userRecord.billingSyncStatus || 'pending',
    planFeatures: userRecord.planFeatures || {},
    usageCampaignsCurrent: userRecord.usageCampaignsCurrent || 0,
    usageCreatorsCurrentMonth: userRecord.usageCreatorsCurrentMonth || 0,
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
  console.log(`🏗️ [USER-QUERIES] createUser called for userId: ${userData.userId}`);
  console.log(`🏗️ [USER-QUERIES] Creating user across normalized tables with data:`, {
    userId: userData.userId,
    email: userData.email,
    fullName: userData.fullName,
    onboardingStep: userData.onboardingStep || 'pending',
    currentPlan: userData.currentPlan || 'free',
    hasTrialStart: !!userData.trialStartDate,
    hasTrialEnd: !!userData.trialEndDate
  });
  
  return db.transaction(async (tx) => {
    console.log(`🏗️ [USER-QUERIES] Starting database transaction for user creation`);
    
    try {
    // 1. Insert core user data
    const [newUser] = await tx.insert(users).values({
      userId: userData.userId,
      email: userData.email,
      fullName: userData.fullName,
      businessName: userData.businessName,
      brandDescription: userData.brandDescription,
      industry: userData.industry,
      onboardingStep: userData.onboardingStep || 'pending',
    }).returning();

    // 2. Insert subscription data
    const [newSubscription] = await tx.insert(userSubscriptions).values({
      userId: newUser.id,
      currentPlan: userData.currentPlan || 'free',
      intendedPlan: userData.intendedPlan,
      trialStatus: userData.trialStartDate ? 'active' : 'pending',
      trialStartDate: userData.trialStartDate,
      trialEndDate: userData.trialEndDate,
    }).returning();

    // 3. Insert usage tracking
    const [newUsage] = await tx.insert(userUsage).values({
      userId: newUser.id,
      planFeatures: {},
      usageCampaignsCurrent: 0,
      usageCreatorsCurrentMonth: 0,
    }).returning();

    // 4. Insert system data
    const [newSystemData] = await tx.insert(userSystemData).values({
      userId: newUser.id,
      emailScheduleStatus: {},
    }).returning();

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
      usageResetDate: newUsage.usageResetDate,
      
      // System data
      signupTimestamp: newSystemData.signupTimestamp,
      emailScheduleStatus: newSystemData.emailScheduleStatus,
      lastWebhookEvent: newSystemData.lastWebhookEvent,
      lastWebhookTimestamp: newSystemData.lastWebhookTimestamp,
    } as UserProfileComplete;
    
    console.log(`✅ [USER-QUERIES] User created successfully across all 5 normalized tables:`, {
      userId: newUser.userId,
      internalId: newUser.id,
      email: userData.email,
      currentPlan: newSubscription.currentPlan,
      trialStatus: newSubscription.trialStatus,
      onboardingStep: newUser.onboardingStep
    });
    
    } catch (error) {
      console.error(`❌ [USER-QUERIES] Database transaction failed during user creation:`, error);
      console.error(`❌ [USER-QUERIES] Failed for userId: ${userData.userId}`);
      throw error;
    }
  });
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
    usageResetDate?: Date;
    
    // System updates
    emailScheduleStatus?: any;
    lastWebhookEvent?: string;
    lastWebhookTimestamp?: Date;
  }
): Promise<void> {
  return db.transaction(async (tx) => {
    // Get user internal ID
    const userRecord = await tx.select({ id: users.id })
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
    if (Object.values(userUpdates).some(val => val !== undefined)) {
      const filteredUpdates = Object.fromEntries(
        Object.entries(userUpdates).filter(([_, v]) => v !== undefined)
      );
      promises.push(
        tx.update(users)
          .set({ ...filteredUpdates, updatedAt: new Date() })
          .where(eq(users.userId, userId))
      );
    }
    
    // Update or insert subscription record
    if (Object.values(subscriptionUpdates).some(val => val !== undefined)) {
      const filteredUpdates = Object.fromEntries(
        Object.entries(subscriptionUpdates).filter(([_, v]) => v !== undefined)
      );
      promises.push(
        tx.update(userSubscriptions)
          .set({ ...filteredUpdates, updatedAt: new Date() })
          .where(eq(userSubscriptions.userId, internalUserId))
      );
    }
    
    // Update or insert billing record  
    if (Object.values(billingUpdates).some(val => val !== undefined)) {
      const filteredUpdates = Object.fromEntries(
        Object.entries(billingUpdates).filter(([_, v]) => v !== undefined)
      );
      // Try update first, insert if doesn't exist
      const existingBilling = await tx.select({ id: userBilling.id })
        .from(userBilling)
        .where(eq(userBilling.userId, internalUserId));
        
      if (existingBilling[0]) {
        promises.push(
          tx.update(userBilling)
            .set({ ...filteredUpdates, updatedAt: new Date() })
            .where(eq(userBilling.userId, internalUserId))
        );
      } else {
        promises.push(
          tx.insert(userBilling)
            .values({ userId: internalUserId, ...filteredUpdates })
        );
      }
    }
    
    // Update usage record
    if (Object.values(usageUpdates).some(val => val !== undefined)) {
      const filteredUpdates = Object.fromEntries(
        Object.entries(usageUpdates).filter(([_, v]) => v !== undefined)
      );
      promises.push(
        tx.update(userUsage)
          .set({ ...filteredUpdates, updatedAt: new Date() })
          .where(eq(userUsage.userId, internalUserId))
      );
    }
    
    // Update system data
    if (Object.values(systemUpdates).some(val => val !== undefined)) {
      const filteredUpdates = Object.fromEntries(
        Object.entries(systemUpdates).filter(([_, v]) => v !== undefined)
      );
      promises.push(
        tx.update(userSystemData)
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
export async function getUserBilling(userId: string): Promise<(UserBilling & { stripeCustomerId: string }) | null> {
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
    
  return result[0] as (UserBilling & { stripeCustomerId: string }) || null;
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
  type: 'campaigns' | 'creators', 
  amount: number = 1
): Promise<void> {
  await db
    .update(userUsage)
    .set({
      ...(type === 'campaigns' 
        ? { usageCampaignsCurrent: sql`usage_campaigns_current + ${amount}` }
        : { usageCreatorsCurrentMonth: sql`usage_creators_current_month + ${amount}` }
      ),
      updatedAt: new Date(),
    })
    .where(
      eq(userUsage.userId, 
        db.select({ id: users.id }).from(users).where(eq(users.userId, userId))
      )
    );
}

/**
 * Find user by Stripe customer ID
 * Used primarily by Stripe webhooks
 */
export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<UserProfileComplete | null> {
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
  
  if (!userRecord || !userRecord.id) {
    return null;
  }
  
  // Transform to match expected format
  return {
    ...userRecord,
    // Ensure required fields have defaults
    currentPlan: userRecord.currentPlan || 'free',
    subscriptionStatus: userRecord.subscriptionStatus || 'none',
    trialStatus: userRecord.trialStatus || 'pending',
    billingSyncStatus: userRecord.billingSyncStatus || 'pending',
    planFeatures: userRecord.planFeatures || {},
    usageCampaignsCurrent: userRecord.usageCampaignsCurrent || 0,
    usageCreatorsCurrentMonth: userRecord.usageCreatorsCurrentMonth || 0,
    usageResetDate: userRecord.usageResetDate || new Date(),
    signupTimestamp: userRecord.signupTimestamp || userRecord.createdAt,
    emailScheduleStatus: userRecord.emailScheduleStatus || {},
  } as UserProfileComplete;
}