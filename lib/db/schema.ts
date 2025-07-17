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

// User Profiles table (updated for Clerk user IDs + onboarding fields + trial system)
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(), // Changed from uuid to text for Clerk user IDs
  name: text('name'),
  companyName: text('company_name'),
  industry: text('industry'),
  email: text('email'),
  // Onboarding fields
  signupTimestamp: timestamp('signup_timestamp').notNull().defaultNow(),
  onboardingStep: varchar('onboarding_step', { length: 50 }).notNull().default('pending'), // 'pending', 'info_captured', 'intent_captured', 'completed'
  fullName: text('full_name'),
  businessName: text('business_name'),
  brandDescription: text('brand_description'),
  emailScheduleStatus: jsonb('email_schedule_status').default('{}'),
  // Trial system fields
  trialStartDate: timestamp('trial_start_date'),
  trialEndDate: timestamp('trial_end_date'),
  trialStatus: varchar('trial_status', { length: 20 }).default('pending'), // 'pending', 'active', 'expired', 'cancelled', 'converted'
  stripeCustomerId: text('stripe_customer_id'), // Repurposed for Clerk billing customer ID
  stripeSubscriptionId: text('stripe_subscription_id'), // Repurposed for Clerk billing subscription ID
  subscriptionStatus: varchar('subscription_status', { length: 20 }).default('none'), // 'none', 'trialing', 'active', 'past_due', 'canceled'
  // Clerk billing fields
  clerkCustomerId: text('clerk_customer_id'),
  clerkSubscriptionId: text('clerk_subscription_id'),
  currentPlan: varchar('current_plan', { length: 50 }).default('free'), // 'free', 'glow_up', 'viral_surge', 'fame_flex'
  // Payment method fields
  paymentMethodId: text('payment_method_id'),
  cardLast4: varchar('card_last_4', { length: 4 }),
  cardBrand: varchar('card_brand', { length: 20 }),
  cardExpMonth: integer('card_exp_month'),
  cardExpYear: integer('card_exp_year'),
  billingAddressCity: text('billing_address_city'),
  billingAddressCountry: varchar('billing_address_country', { length: 2 }),
  billingAddressPostalCode: varchar('billing_address_postal_code', { length: 20 }),
  // Plan feature tracking
  planCampaignsLimit: integer('plan_campaigns_limit'),
  planCreatorsLimit: integer('plan_creators_limit'),
  planFeatures: jsonb('plan_features'),
  usageCampaignsCurrent: integer('usage_campaigns_current').default(0),
  usageCreatorsCurrentMonth: integer('usage_creators_current_month').default(0),
  usageResetDate: timestamp('usage_reset_date').defaultNow(),
  // Billing webhook tracking
  lastWebhookEvent: varchar('last_webhook_event', { length: 100 }),
  lastWebhookTimestamp: timestamp('last_webhook_timestamp'),
  billingSyncStatus: varchar('billing_sync_status', { length: 20 }).default('pending'),
  trialConversionDate: timestamp('trial_conversion_date'),
  subscriptionCancelDate: timestamp('subscription_cancel_date'),
  subscriptionRenewalDate: timestamp('subscription_renewal_date'),
  // Admin system field
  isAdmin: boolean('is_admin').default(false), // Database-based admin role
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type SystemConfiguration = typeof systemConfigurations.$inferSelect;
export type NewSystemConfiguration = typeof systemConfigurations.$inferInsert;