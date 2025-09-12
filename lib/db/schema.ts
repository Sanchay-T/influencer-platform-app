import { pgTable, uuid, text, varchar, timestamp, integer, jsonb, numeric, unique, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Status types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'error' | 'timeout';
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'archived';

// Campaigns table
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  searchType: varchar('search_type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Scraping Jobs table
export const scrapingJobs = pgTable('scraping_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  runId: text('run_id'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  keywords: jsonb('keywords'),
  platform: varchar('platform', { length: 50 }).notNull().default('Tiktok'),
  region: varchar('region', { length: 10 }).notNull().default('US'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  error: text('error'),
  timeoutAt: timestamp('timeout_at'),
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  targetUsername: text('target_username'),
  searchParams: jsonb('search_params'),
  qstashMessageId: text('qstash_message_id'),
  processedRuns: integer('processed_runs').notNull().default(0),
  processedResults: integer('processed_results').notNull().default(0),
  targetResults: integer('target_results').notNull().default(1000),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  cursor: integer('cursor').default(0),
  progress: numeric('progress').default('0'),
});

// Scraping Results table
export const scrapingResults = pgTable('scraping_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => scrapingJobs.id),
  creators: jsonb('creators').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Search Jobs table (legacy/alternative)
export const searchJobs = pgTable('search_jobs', {
  id: text('id').primaryKey(),
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  platform: varchar('platform', { length: 20 }).notNull(),
  searchType: varchar('search_type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('queued'),
  totalCount: integer('total_count').notNull(),
  completedCount: integer('completed_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Search Results table (legacy/alternative)
export const searchResults = pgTable('search_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: text('job_id').notNull().references(() => searchJobs.id),
  profileId: text('profile_id').notNull(),
  username: text('username').notNull(),
  displayName: text('display_name'),
  platform: varchar('platform', { length: 20 }).notNull(),
  profileUrl: text('profile_url'),
  postUrl: text('post_url'),
  postDescription: text('post_description'),
  avatarUrl: text('avatar_url'),
  followers: integer('followers').default(0),
  isVerified: varchar('is_verified', { length: 10 }).default('false'),
  email: text('email'),
  bio: text('bio'),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// =====================================================
// NORMALIZED USER TABLES (Replaces monolithic user_profiles)
// =====================================================

// 1. USERS - Core identity and profile information
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').unique().notNull(), // External auth ID (Clerk)
  email: text('email'),
  fullName: text('full_name'),
  businessName: text('business_name'),
  brandDescription: text('brand_description'),
  industry: text('industry'),
  onboardingStep: varchar('onboarding_step', { length: 50 }).default('pending').notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. USER_SUBSCRIPTIONS - Trial and subscription management
export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  currentPlan: varchar('current_plan', { length: 50 }).default('free').notNull(),
  intendedPlan: varchar('intended_plan', { length: 50 }), // Plan selected before checkout
  subscriptionStatus: varchar('subscription_status', { length: 20 }).default('none').notNull(),
  trialStatus: varchar('trial_status', { length: 20 }).default('pending').notNull(),
  trialStartDate: timestamp('trial_start_date'),
  trialEndDate: timestamp('trial_end_date'),
  trialConversionDate: timestamp('trial_conversion_date'),
  subscriptionCancelDate: timestamp('subscription_cancel_date'),
  subscriptionRenewalDate: timestamp('subscription_renewal_date'),
  billingSyncStatus: varchar('billing_sync_status', { length: 20 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. USER_BILLING - Stripe payment data (Clerk artifacts removed)
export const userBilling = pgTable('user_billing', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  paymentMethodId: text('payment_method_id'),
  cardLast4: varchar('card_last_4', { length: 4 }),
  cardBrand: varchar('card_brand', { length: 20 }),
  cardExpMonth: integer('card_exp_month'),
  cardExpYear: integer('card_exp_year'),
  billingAddressCity: text('billing_address_city'),
  billingAddressCountry: varchar('billing_address_country', { length: 2 }),
  billingAddressPostalCode: varchar('billing_address_postal_code', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. USER_USAGE - Usage tracking and plan limits
export const userUsage = pgTable('user_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planCampaignsLimit: integer('plan_campaigns_limit'),
  planCreatorsLimit: integer('plan_creators_limit'),
  planFeatures: jsonb('plan_features').default('{}').notNull(),
  usageCampaignsCurrent: integer('usage_campaigns_current').default(0).notNull(),
  usageCreatorsCurrentMonth: integer('usage_creators_current_month').default(0).notNull(),
  usageResetDate: timestamp('usage_reset_date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. USER_SYSTEM_DATA - System metadata and webhook tracking
export const userSystemData = pgTable('user_system_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  signupTimestamp: timestamp('signup_timestamp').defaultNow().notNull(),
  emailScheduleStatus: jsonb('email_schedule_status').default('{}').notNull(),
  lastWebhookEvent: varchar('last_webhook_event', { length: 100 }),
  lastWebhookTimestamp: timestamp('last_webhook_timestamp'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// System Configurations table
export const systemConfigurations = pgTable('system_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: varchar('category', { length: 50 }).notNull(),
  key: varchar('key', { length: 100 }).notNull(),
  value: text('value').notNull(),
  valueType: varchar('value_type', { length: 20 }).notNull(), // 'number', 'duration', 'boolean'
  description: text('description'),
  isHotReloadable: varchar('is_hot_reloadable', { length: 5 }).notNull().default('true'), // 'true' or 'false'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueCategoryKey: unique().on(table.category, table.key),
}));

// Event Sourcing table for tracking all state changes (Industry Standard)
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  aggregateId: text('aggregate_id').notNull(), // User ID, Job ID, etc.
  aggregateType: varchar('aggregate_type', { length: 50 }).notNull(), // 'user', 'subscription', 'onboarding'
  eventType: varchar('event_type', { length: 100 }).notNull(), // 'subscription_created', 'onboarding_completed'
  eventVersion: integer('event_version').notNull().default(1),
  eventData: jsonb('event_data').notNull(), // Full event payload
  metadata: jsonb('metadata'), // Request ID, source, user agent, etc.
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  processedAt: timestamp('processed_at'), // When background job processed this event
  processingStatus: varchar('processing_status', { length: 20 }).notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  retryCount: integer('retry_count').notNull().default(0),
  error: text('error'), // Error message if processing failed
  idempotencyKey: text('idempotency_key').notNull().unique(), // Prevent duplicate processing
  sourceSystem: varchar('source_system', { length: 50 }).notNull(), // 'stripe_webhook', 'admin_action', 'user_action'
  correlationId: text('correlation_id'), // Track related events
  causationId: text('causation_id'), // What caused this event
});

// Background Jobs table for QStash job tracking (Industry Standard)
export const backgroundJobs = pgTable('background_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobType: varchar('job_type', { length: 100 }).notNull(), // 'complete_onboarding', 'send_trial_email'
  payload: jsonb('payload').notNull(), // Job data
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  qstashMessageId: text('qstash_message_id'), // QStash message ID for tracking
  priority: integer('priority').notNull().default(100), // Lower = higher priority
  maxRetries: integer('max_retries').notNull().default(3),
  retryCount: integer('retry_count').notNull().default(0),
  scheduledFor: timestamp('scheduled_for').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  failedAt: timestamp('failed_at'),
  error: text('error'),
  result: jsonb('result'), // Job execution result
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Subscription Plans table - Plan configuration and limits
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  planKey: varchar('plan_key', { length: 50 }).notNull().unique(), // 'glow_up', 'viral_surge', 'fame_flex'
  displayName: text('display_name').notNull(), // 'Glow Up Plan'
  description: text('description'), // Plan description
  // Pricing
  monthlyPrice: integer('monthly_price').notNull(), // Price in cents (9900 = $99.00)
  yearlyPrice: integer('yearly_price'), // Yearly price in cents (optional)
  // Stripe Price IDs
  stripeMonthlaPriceId: text('stripe_monthly_price_id').notNull(),
  stripeYearlyPriceId: text('stripe_yearly_price_id'),
  // Plan Limits
  campaignsLimit: integer('campaigns_limit').notNull(), // Max active campaigns
  creatorsLimit: integer('creators_limit').notNull(), // Max creators per month
  // Features
  features: jsonb('features').default('{}'), // JSON object with feature flags
  // Status
  isActive: boolean('is_active').notNull().default(true),
  // Metadata
  sortOrder: integer('sort_order').default(0), // For display ordering
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations
export const campaignRelations = relations(campaigns, ({ many }) => ({
  scrapingJobs: many(scrapingJobs),
  searchJobs: many(searchJobs),
}));

export const scrapingJobsRelations = relations(scrapingJobs, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [scrapingJobs.campaignId],
    references: [campaigns.id],
  }),
  results: many(scrapingResults),
}));

export const scrapingResultsRelations = relations(scrapingResults, ({ one }) => ({
  job: one(scrapingJobs, {
    fields: [scrapingResults.jobId],
    references: [scrapingJobs.id],
  }),
}));

export const searchJobsRelations = relations(searchJobs, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [searchJobs.campaignId],
    references: [campaigns.id],
  }),
  results: many(searchResults),
}));

export const searchResultsRelations = relations(searchResults, ({ one }) => ({
  job: one(searchJobs, {
    fields: [searchResults.jobId],
    references: [searchJobs.id],
  }),
}));

// =====================================================
// NORMALIZED USER TABLE RELATIONS
// =====================================================

// Users relations
export const usersRelations = relations(users, ({ one, many }) => ({
  subscription: one(userSubscriptions, {
    fields: [users.id],
    references: [userSubscriptions.userId],
  }),
  billing: one(userBilling, {
    fields: [users.id], 
    references: [userBilling.userId],
  }),
  usage: one(userUsage, {
    fields: [users.id],
    references: [userUsage.userId],
  }),
  systemData: one(userSystemData, {
    fields: [users.id],
    references: [userSystemData.userId],
  }),
  campaigns: many(campaigns), // Assuming campaigns will reference users eventually
}));

// User subscriptions relations
export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
}));

// User billing relations
export const userBillingRelations = relations(userBilling, ({ one }) => ({
  user: one(users, {
    fields: [userBilling.userId],
    references: [users.id],
  }),
}));

// User usage relations
export const userUsageRelations = relations(userUsage, ({ one }) => ({
  user: one(users, {
    fields: [userUsage.userId],
    references: [users.id],
  }),
}));

// User system data relations
export const userSystemDataRelations = relations(userSystemData, ({ one }) => ({
  user: one(users, {
    fields: [userSystemData.userId],
    references: [users.id],
  }),
}));

// Export types for TypeScript
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type NewScrapingJob = typeof scrapingJobs.$inferInsert;
export type ScrapingResult = typeof scrapingResults.$inferSelect;
export type NewScrapingResult = typeof scrapingResults.$inferInsert;
export type SearchJob = typeof searchJobs.$inferSelect;
export type NewSearchJob = typeof searchJobs.$inferInsert;
export type SearchResult = typeof searchResults.$inferSelect;
export type NewSearchResult = typeof searchResults.$inferInsert;
// Note: UserProfile types have been replaced by UserProfileComplete for backward compatibility
// Individual normalized table types are available as User, UserSubscription, UserBilling, etc.
export type SystemConfiguration = typeof systemConfigurations.$inferSelect;
export type NewSystemConfiguration = typeof systemConfigurations.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewBackgroundJob = typeof backgroundJobs.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// =====================================================
// NORMALIZED USER TABLE TYPES
// =====================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;
export type UserBilling = typeof userBilling.$inferSelect;
export type NewUserBilling = typeof userBilling.$inferInsert;
export type UserUsage = typeof userUsage.$inferSelect;
export type NewUserUsage = typeof userUsage.$inferInsert;
export type UserSystemData = typeof userSystemData.$inferSelect;
export type NewUserSystemData = typeof userSystemData.$inferInsert;

// Combined user profile type for backward compatibility
export type UserProfileComplete = {
  // Core user data
  id: string;
  userId: string;
  email?: string | null;
  fullName?: string | null;
  businessName?: string | null;
  brandDescription?: string | null;
  industry?: string | null;
  onboardingStep: string;
  isAdmin: boolean;
  
  // Subscription data
  currentPlan: string;
  intendedPlan?: string | null;
  subscriptionStatus: string;
  trialStatus: string;
  trialStartDate?: Date | null;
  trialEndDate?: Date | null;
  trialConversionDate?: Date | null;
  subscriptionCancelDate?: Date | null;
  subscriptionRenewalDate?: Date | null;
  billingSyncStatus: string;
  
  // Billing data
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  paymentMethodId?: string | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  cardExpMonth?: number | null;
  cardExpYear?: number | null;
  billingAddressCity?: string | null;
  billingAddressCountry?: string | null;
  billingAddressPostalCode?: string | null;
  
  // Usage data
  planCampaignsLimit?: number | null;
  planCreatorsLimit?: number | null;
  planFeatures: any;
  usageCampaignsCurrent: number;
  usageCreatorsCurrentMonth: number;
  usageResetDate: Date;
  
  // System data
  signupTimestamp: Date;
  emailScheduleStatus: any;
  lastWebhookEvent?: string | null;
  lastWebhookTimestamp?: Date | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
};
