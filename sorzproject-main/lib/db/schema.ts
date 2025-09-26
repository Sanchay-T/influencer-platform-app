import { pgTable, text, timestamp, uuid, jsonb, varchar, integer, decimal } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export type CreatorResult = {
  profile: string;
  keywords: string[];
  platformName: string;
  followers: number;
  region: string;
  profileUrl: string;
  creatorCategory: string[];
}

// Para la tabla
export type ScrapingResult = {
  creators: CreatorResult[] | InstagramRelatedProfile[];
  platform: 'Tiktok' | 'Instagram';
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'error' | 'timeout';

export type CampaignStatus = 'draft' | 'active' | 'completed' | 'archived';

export type InstagramRelatedProfile = {
  id: string;
  full_name: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string;
  username: string;
}

// Para la API
export type PlatformResult = {
  platform: 'Tiktok' | 'Instagram';
  data: CreatorResult[] | InstagramRelatedProfile[];
}

// Tabla de perfiles de usuario
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique(),
  name: text('name').notNull(),
  company_name: text('company_name').notNull(),
  industry: text('industry').notNull(),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  searchType: varchar('search_type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const scrapingJobs = pgTable('scraping_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  runId: text('run_id'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  keywords: jsonb('keywords').$type<string[]>(),
  targetUsername: text('target_username'),
  searchParams: jsonb('search_params'),
  platform: varchar('platform', { length: 50 }).notNull().default('Tiktok'), // Esto se puede quedar por ahora así, pero la idea es que el campo se llene dependiendo de si es tiktok o instagram
  region: varchar('region', { length: 10 }).notNull().default('US'), // No hace mucho sentido tener este campo, pero lo dejamos por ahora, lo podríamo quitar
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  error: text('error'),
  timeoutAt: timestamp('timeout_at'),
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  qstashMessageId: text('qstash_message_id'),
  processedRuns: integer('processed_runs').notNull().default(0),
  processedResults: integer('processed_results').notNull().default(0),
  targetResults: integer('target_results').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  cursor: integer('cursor').default(0),
  progress: decimal('progress').default('0')
});

export const scrapingResults = pgTable('scraping_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => scrapingJobs.id),
  creators: jsonb('creators').$type<CreatorResult[] | InstagramRelatedProfile[]>().notNull(), // Aqui se almacenan los resultados del scraping en json
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => scrapingJobs.id),
  type: varchar('type', { length: 20 }).notNull(), // email | webhook
  event: varchar('event', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  error: text('error'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  sentAt: timestamp('sent_at'),
  retries: integer('retries').default(0),
  maxRetries: integer('max_retries').default(3)
})

export const notificationRelations = relations(notifications, ({ one }) => ({
  job: one(scrapingJobs, {
    fields: [notifications.jobId],
    references: [scrapingJobs.id]
  })
}))

export const campaignRelations = relations(campaigns, ({ many }) => ({
  scrapingJobs: many(scrapingJobs)
}));

export const scrapingJobsRelations = relations(scrapingJobs, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [scrapingJobs.campaignId],
    references: [campaigns.id]
  }),
  results: many(scrapingResults)
}));

export const scrapingResultsRelations = relations(scrapingResults, ({ one }) => ({
  job: one(scrapingJobs, {
    fields: [scrapingResults.jobId],
    references: [scrapingJobs.id]
  })
})); 