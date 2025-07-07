import { pgTable, uuid, text, varchar, timestamp, integer, jsonb, numeric, unique } from 'drizzle-orm/pg-core';
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

// User Profiles table (updated for Clerk user IDs)
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(), // Changed from uuid to text for Clerk user IDs
  name: text('name').notNull(),
  companyName: text('company_name').notNull(),
  industry: text('industry').notNull(),
  email: text('email'),
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