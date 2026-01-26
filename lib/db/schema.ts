import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

// Status types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'error' | 'timeout';
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'archived';
export type CreatorListType =
	| 'campaign'
	| 'favorites'
	| 'industry'
	| 'research'
	| 'contacted'
	| 'custom';
export type CreatorListPrivacy = 'private' | 'public' | 'workspace';
export type CreatorListRole = 'owner' | 'editor' | 'viewer';

// Campaigns table
export const campaigns = pgTable(
	'campaigns',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id').notNull(),
		name: text('name').notNull(),
		description: text('description'),
		searchType: varchar('search_type', { length: 20 }).notNull(),
		status: varchar('status', { length: 20 }).notNull().default('draft'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
	},
	(table) => ({
		// @performance Indexes for user-scoped queries (dashboard, campaign list)
		userIdIdx: index('idx_campaigns_user_id').on(table.userId),
		userStatusIdx: index('idx_campaigns_user_status').on(table.userId, table.status),
	})
);

// Scraping Jobs table
export const scrapingJobs = pgTable(
	'scraping_jobs',
	{
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
		// V2 Fan-Out Worker Coordination
		keywordsDispatched: integer('keywords_dispatched').default(0),
		keywordsCompleted: integer('keywords_completed').default(0),
		creatorsFound: integer('creators_found').default(0),
		creatorsEnriched: integer('creators_enriched').default(0),
		enrichmentStatus: varchar('enrichment_status', { length: 20 }).default('pending'),
		// Adaptive re-expansion tracking
		expansionRound: integer('expansion_round').default(1),
		usedKeywords: jsonb('used_keywords'), // All keywords tried (for deduplication)
	},
	(table) => ({
		// @performance Indexes for user-scoped queries (job list, status filtering)
		userStatusIdx: index('idx_scraping_jobs_user_status').on(table.userId, table.status),
		userCreatedIdx: index('idx_scraping_jobs_user_created').on(table.userId, table.createdAt),
	})
);

// Scraping Results table
export const scrapingResults = pgTable(
	'scraping_results',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		jobId: uuid('job_id').references(() => scrapingJobs.id),
		creators: jsonb('creators').notNull(),
		createdAt: timestamp('created_at').notNull().defaultNow(),
	},
	(table) => ({
		jobIdIdx: index('idx_scraping_results_job_id').on(table.jobId),
	})
);

// Job Creator Keys - Atomic deduplication via unique constraint
// Used by v2 workers to prevent duplicate creators across parallel workers
// Works with PgBouncer (no FOR UPDATE locks needed)
// DEPRECATED: Being replaced by jobCreators table which stores full creator data
export const jobCreatorKeys = pgTable(
	'job_creator_keys',
	{
		jobId: uuid('job_id')
			.notNull()
			.references(() => scrapingJobs.id, { onDelete: 'cascade' }),
		creatorKey: text('creator_key').notNull(),
		createdAt: timestamp('created_at').notNull().defaultNow(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.jobId, table.creatorKey] }),
	})
);

// Job Creators - Stores individual creators with automatic deduplication
// Replaces both jobCreatorKeys (dedup) and scrapingResults (JSON storage)
// UNIQUE constraint allows parallel workers to INSERT without race conditions
export const jobCreators = pgTable(
	'job_creators',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		jobId: uuid('job_id')
			.notNull()
			.references(() => scrapingJobs.id, { onDelete: 'cascade' }),
		platform: varchar('platform', { length: 50 }).notNull(),
		username: varchar('username', { length: 255 }).notNull(),
		creatorData: jsonb('creator_data').notNull(), // Full NormalizedCreator object
		// @context Enrichment tracking - proper column instead of JSON extraction
		// @why Indexed column is faster than JSON->>'bioEnriched' for completion queries
		enriched: boolean('enriched').notNull().default(false),
		// @context USE2-17: Track which keyword found this creator
		// @why Enables filtering/sorting creators by source keyword in results UI
		keyword: varchar('keyword', { length: 255 }),
		createdAt: timestamp('created_at').notNull().defaultNow(),
	},
	(table) => ({
		// UNIQUE constraint for automatic deduplication - DB rejects duplicates
		uniqueCreator: unique('job_creators_unique').on(table.jobId, table.platform, table.username),
		// Index for fast job lookups and pagination
		jobIdIdx: index('idx_job_creators_job_id').on(table.jobId),
		// Index for fast completion queries (COUNT WHERE enriched = true)
		enrichedIdx: index('idx_job_creators_enriched').on(table.jobId, table.enriched),
		// Index for fast keyword filtering (USE2-17)
		keywordIdx: index('idx_job_creators_keyword').on(table.jobId, table.keyword),
	})
);

// Export Jobs - Track background CSV export jobs
// @context CSV exports run in background via QStash to avoid timeout
export const exportJobs = pgTable(
	'export_jobs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id').notNull(),
		campaignId: uuid('campaign_id').references(() => campaigns.id),
		jobId: uuid('job_id').references(() => scrapingJobs.id), // For single job export
		status: varchar('status', { length: 20 }).notNull().default('pending'),
		// Status flow: pending → processing → completed | failed
		totalCreators: integer('total_creators'),
		downloadUrl: text('download_url'),
		expiresAt: timestamp('expires_at'), // Vercel Blob TTL
		error: text('error'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		completedAt: timestamp('completed_at'),
	},
	(table) => ({
		userIdIdx: index('idx_export_jobs_user_id').on(table.userId),
		statusIdx: index('idx_export_jobs_status').on(table.status),
	})
);

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
	jobId: text('job_id')
		.notNull()
		.references(() => searchJobs.id),
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
export const users = pgTable(
	'users',
	{
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
	},
	(table) => ({
		// @performance Index for Clerk user_id lookups (auth middleware, API guards)
		// Note: unique() constraint creates an index but explicit index is clearer
		userIdIdx: index('idx_users_user_id').on(table.userId),
	})
);

// 2. USER_SUBSCRIPTIONS - Trial and subscription management
export const userSubscriptions = pgTable('user_subscriptions', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	// NULL = user hasn't completed onboarding/payment yet
	// Set by Stripe webhook after successful payment
	currentPlan: varchar('current_plan', { length: 50 }),
	intendedPlan: varchar('intended_plan', { length: 50 }), // Plan selected before checkout
	subscriptionStatus: varchar('subscription_status', { length: 20 }).default('none').notNull(),
	// trialStatus REMOVED - now derived from subscriptionStatus + trialEndDate via deriveTrialStatus()
	trialStartDate: timestamp('trial_start_date'),
	trialEndDate: timestamp('trial_end_date'),
	subscriptionCancelDate: timestamp('subscription_cancel_date'),
	// Removed: trialConversionDate, subscriptionRenewalDate (never used)
	billingSyncStatus: varchar('billing_sync_status', { length: 20 }).default('pending').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. USER_BILLING - Stripe payment data (minimal - Stripe is source of truth)
export const userBilling = pgTable('user_billing', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	stripeCustomerId: text('stripe_customer_id').unique(),
	stripeSubscriptionId: text('stripe_subscription_id'),
	// Removed: paymentMethodId, card*, billingAddress* (Stripe Portal handles this)
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. USER_USAGE - Usage tracking and plan limits
export const userUsage = pgTable('user_usage', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	// DEPRECATED: These columns are set but never read. Limits come from PLANS config in plan-config.ts
	// TODO: Remove in future migration
	planCampaignsLimit: integer('plan_campaigns_limit'),
	planCreatorsLimit: integer('plan_creators_limit'),
	planFeatures: jsonb('plan_features').default('{}').notNull(),
	// Active usage tracking
	usageCampaignsCurrent: integer('usage_campaigns_current').default(0).notNull(),
	usageCreatorsCurrentMonth: integer('usage_creators_current_month').default(0).notNull(),
	// DEPRECATED: Never incremented - enrichment feature not implemented
	enrichmentsCurrentMonth: integer('enrichments_current_month').default(0).notNull(),
	usageResetDate: timestamp('usage_reset_date').defaultNow().notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. USER_SYSTEM_DATA - System metadata and webhook tracking
export const userSystemData = pgTable('user_system_data', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	signupTimestamp: timestamp('signup_timestamp').defaultNow().notNull(),
	emailScheduleStatus: jsonb('email_schedule_status').default('{}').notNull(),
	lastWebhookEvent: varchar('last_webhook_event', { length: 100 }),
	lastWebhookTimestamp: timestamp('last_webhook_timestamp'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// System Configurations table
export const systemConfigurations = pgTable(
	'system_configurations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		category: varchar('category', { length: 50 }).notNull(),
		key: varchar('key', { length: 100 }).notNull(),
		value: text('value').notNull(),
		valueType: varchar('value_type', { length: 20 }).notNull(), // 'number', 'duration', 'boolean'
		description: text('description'),
		isHotReloadable: varchar('is_hot_reloadable', { length: 5 }).notNull().default('true'), // 'true' or 'false'
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
	},
	(table) => ({
		uniqueCategoryKey: unique().on(table.category, table.key),
	})
);

// Webhook Events table for idempotency and deduplication
// Tracks all incoming webhooks from external services (Stripe, Clerk)
export type WebhookStatus = 'processing' | 'completed' | 'failed';
export type WebhookSource = 'stripe' | 'clerk' | 'qstash';

export const webhookEvents = pgTable(
	'webhook_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		eventId: text('event_id').notNull().unique(), // External event ID (from Stripe/Clerk)
		source: varchar('source', { length: 20 }).notNull(), // 'stripe' | 'clerk' | 'qstash'
		eventType: varchar('event_type', { length: 100 }).notNull(), // e.g., 'customer.subscription.created'
		status: varchar('status', { length: 20 }).notNull().default('processing'), // 'processing' | 'completed' | 'failed'
		eventTimestamp: timestamp('event_timestamp'), // When the event was created at source
		processedAt: timestamp('processed_at'), // When we finished processing
		createdAt: timestamp('created_at').notNull().defaultNow(), // When we received it
		errorMessage: text('error_message'), // Error details if failed
		retryCount: integer('retry_count').notNull().default(0),
		payload: jsonb('payload'), // Optional: store event payload for debugging
		metadata: jsonb('metadata'), // Additional context (request ID, etc.)
	},
	(table) => ({
		// @performance Index for idempotency checks and cleanup queries
		statusIdx: index('idx_webhook_events_status').on(table.status),
		statusCreatedAtIdx: index('idx_webhook_events_status_created_at').on(
			table.status,
			table.createdAt
		),
	})
);

// Event Sourcing table for tracking all state changes (Industry Standard)
export const events = pgTable(
	'events',
	{
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
	},
	(table) => ({
		// @performance Indexes for event sourcing queries
		aggregateIdIdx: index('idx_events_aggregate_id').on(table.aggregateId),
		aggregateIdTypeIdx: index('idx_events_aggregate_id_type').on(
			table.aggregateId,
			table.aggregateType
		),
		eventTypeIdx: index('idx_events_event_type').on(table.eventType),
		processingStatusIdx: index('idx_events_processing_status').on(table.processingStatus),
	})
);

// Creator directory tables -------------------------------------------------
export const creatorProfiles = pgTable(
	'creator_profiles',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		platform: varchar('platform', { length: 32 }).notNull(),
		externalId: text('external_id').notNull(),
		handle: text('handle').notNull(),
		displayName: text('display_name'),
		avatarUrl: text('avatar_url'),
		url: text('url'),
		followers: integer('followers'),
		engagementRate: numeric('engagement_rate'),
		category: text('category'),
		metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
	},
	(table) => ({
		uniquePlatformExternal: unique('creator_profiles_platform_external_unique').on(
			table.platform,
			table.externalId
		),
	})
);

export const creatorLists = pgTable(
	'creator_lists',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ownerId: uuid('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		type: varchar('type', { length: 24 }).notNull().default('custom'),
		privacy: varchar('privacy', { length: 16 }).notNull().default('private'),
		tags: jsonb('tags').notNull().default(sql`'[]'::jsonb`),
		settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
		stats: jsonb('stats').notNull().default(sql`'{}'::jsonb`),
		isArchived: boolean('is_archived').notNull().default(false),
		slug: text('slug'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
		lastSharedAt: timestamp('last_shared_at'),
	},
	(table) => ({
		// @performance Indexes for owner-scoped queries (list view, filtering)
		ownerIdx: index('idx_creator_lists_owner').on(table.ownerId),
		ownerArchivedIdx: index('idx_creator_lists_owner_archived').on(table.ownerId, table.isArchived),
	})
);

export const creatorListItems = pgTable(
	'creator_list_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		listId: uuid('list_id')
			.notNull()
			.references(() => creatorLists.id, { onDelete: 'cascade' }),
		creatorId: uuid('creator_id')
			.notNull()
			.references(() => creatorProfiles.id, { onDelete: 'cascade' }),
		position: integer('position').notNull().default(0),
		bucket: varchar('bucket', { length: 32 }).notNull().default('backlog'),
		addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
		addedAt: timestamp('added_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
		notes: text('notes'),
		metricsSnapshot: jsonb('metrics_snapshot').notNull().default(sql`'{}'::jsonb`),
		customFields: jsonb('custom_fields').notNull().default(sql`'{}'::jsonb`),
		pinned: boolean('pinned').notNull().default(false),
		lastContactedAt: timestamp('last_contacted_at'),
	},
	(table) => ({
		uniqueListCreator: unique('creator_list_items_list_creator_unique').on(
			table.listId,
			table.creatorId
		),
	})
);

export const creatorListCollaborators = pgTable(
	'creator_list_collaborators',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		listId: uuid('list_id')
			.notNull()
			.references(() => creatorLists.id, { onDelete: 'cascade' }),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
		inviteEmail: text('invite_email'),
		role: varchar('role', { length: 16 }).notNull().default('viewer'),
		status: varchar('status', { length: 16 }).notNull().default('pending'),
		invitationToken: text('invitation_token'),
		invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
		lastSeenAt: timestamp('last_seen_at'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
	},
	(table) => ({
		uniqueUserList: unique('creator_list_collaborators_user_list_unique').on(
			table.listId,
			table.userId
		),
		uniqueInvite: unique('creator_list_collaborators_invite_unique').on(
			table.listId,
			table.inviteEmail
		),
	})
);

export const creatorListNotes = pgTable('creator_list_notes', {
	id: uuid('id').primaryKey().defaultRandom(),
	listId: uuid('list_id')
		.notNull()
		.references(() => creatorLists.id, { onDelete: 'cascade' }),
	creatorId: uuid('creator_id').references(() => creatorProfiles.id, { onDelete: 'cascade' }),
	authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
	body: text('body').notNull(),
	isInternal: boolean('is_internal').notNull().default(false),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const creatorListActivities = pgTable('creator_list_activities', {
	id: uuid('id').primaryKey().defaultRandom(),
	listId: uuid('list_id')
		.notNull()
		.references(() => creatorLists.id, { onDelete: 'cascade' }),
	actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
	action: varchar('action', { length: 64 }).notNull(),
	payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const listExports = pgTable('list_exports', {
	id: uuid('id').primaryKey().defaultRandom(),
	listId: uuid('list_id')
		.notNull()
		.references(() => creatorLists.id, { onDelete: 'cascade' }),
	requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
	format: varchar('format', { length: 16 }).notNull().default('csv'),
	status: varchar('status', { length: 16 }).notNull().default('queued'),
	fileUrl: text('file_url'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	completedAt: timestamp('completed_at'),
});

// Background Jobs table for QStash job tracking (Industry Standard)
export const backgroundJobs = pgTable(
	'background_jobs',
	{
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
	},
	(table) => ({
		// @performance Indexes for job processing queries
		statusIdx: index('idx_background_jobs_status').on(table.status),
		jobTypeStatusIdx: index('idx_background_jobs_job_type_status').on(table.jobType, table.status),
		scheduledForIdx: index('idx_background_jobs_scheduled_for').on(table.scheduledFor),
	})
);

// =====================================================
// PLAN LIMITS - Dynamic plan configuration (DB-driven)
// =====================================================
// @context New pricing migration (Jan 2026)
// @why Enables changing plan limits without code deploys
// Source of truth for all plan limits and features
export const planLimits = pgTable(
	'plan_limits',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		planKey: varchar('plan_key', { length: 50 }).notNull().unique(), // 'growth', 'scale', 'pro', 'glow_up', etc.
		displayName: varchar('display_name', { length: 100 }).notNull(),

		// Pricing (in cents)
		monthlyPrice: integer('monthly_price').notNull(),
		yearlyPrice: integer('yearly_price').notNull(),

		// Limits (-1 = unlimited)
		creatorsPerMonth: integer('creators_per_month').notNull(),
		enrichmentsPerMonth: integer('enrichments_per_month').notNull(),
		campaignsLimit: integer('campaigns_limit').notNull(),

		// Features as JSONB: { csvExport: true, analytics: 'basic'|'advanced', apiAccess: boolean, prioritySupport: boolean }
		features: jsonb('features').notNull(),

		// Metadata for UI and filtering
		isLegacy: boolean('is_legacy').notNull().default(false), // true for grandfathered plans (glow_up, viral_surge, fame_flex)
		isVisible: boolean('is_visible').notNull().default(true), // false hides from pricing pages
		displayOrder: integer('display_order').notNull().default(0), // For sorting in UI

		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
	},
	(table) => ({
		// @performance Index for quick plan lookups by key
		planKeyIdx: index('idx_plan_limits_plan_key').on(table.planKey),
		// @performance Index for visible plans query (pricing page)
		visibleIdx: index('idx_plan_limits_visible').on(table.isVisible, table.displayOrder),
	})
);

// DEPRECATED: subscription_plans table - Plan configuration is now in lib/billing/plan-config.ts
// This table is only used by admin API (/api/admin/plans/) and seed scripts.
// Source of truth for billing logic is the static PLANS config.
// TODO: Consider removing this table and migrating admin API to use static config
export const subscriptionPlans = pgTable('subscription_plans', {
	id: uuid('id').primaryKey().defaultRandom(),
	planKey: varchar('plan_key', { length: 50 }).notNull().unique(), // 'glow_up', 'viral_surge', 'fame_flex'
	displayName: text('display_name').notNull(), // 'Glow Up Plan'
	description: text('description'), // Plan description
	// Pricing
	monthlyPrice: integer('monthly_price').notNull(), // Price in cents (9900 = $99.00)
	yearlyPrice: integer('yearly_price'), // Yearly price in cents (optional)
	// Stripe Price IDs
	stripeMonthlyPriceId: text('stripe_monthly_price_id').notNull(),
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
	creators: many(jobCreators),
}));

export const jobCreatorsRelations = relations(jobCreators, ({ one }) => ({
	job: one(scrapingJobs, {
		fields: [jobCreators.jobId],
		references: [scrapingJobs.id],
	}),
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
	lists: many(creatorLists),
	collaborations: many(creatorListCollaborators),
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

export const creatorProfilesRelations = relations(creatorProfiles, ({ many }) => ({
	items: many(creatorListItems),
	notes: many(creatorListNotes),
}));

export const creatorListsRelations = relations(creatorLists, ({ one, many }) => ({
	owner: one(users, {
		fields: [creatorLists.ownerId],
		references: [users.id],
	}),
	items: many(creatorListItems),
	collaborators: many(creatorListCollaborators),
	notes: many(creatorListNotes),
	activities: many(creatorListActivities),
	exports: many(listExports),
}));

export const creatorListItemsRelations = relations(creatorListItems, ({ one }) => ({
	list: one(creatorLists, {
		fields: [creatorListItems.listId],
		references: [creatorLists.id],
	}),
	creator: one(creatorProfiles, {
		fields: [creatorListItems.creatorId],
		references: [creatorProfiles.id],
	}),
	addedByUser: one(users, {
		fields: [creatorListItems.addedBy],
		references: [users.id],
	}),
}));

export const creatorListCollaboratorsRelations = relations(creatorListCollaborators, ({ one }) => ({
	list: one(creatorLists, {
		fields: [creatorListCollaborators.listId],
		references: [creatorLists.id],
	}),
	user: one(users, {
		fields: [creatorListCollaborators.userId],
		references: [users.id],
	}),
	invitedByUser: one(users, {
		fields: [creatorListCollaborators.invitedBy],
		references: [users.id],
	}),
}));

export const creatorListNotesRelations = relations(creatorListNotes, ({ one }) => ({
	list: one(creatorLists, {
		fields: [creatorListNotes.listId],
		references: [creatorLists.id],
	}),
	creator: one(creatorProfiles, {
		fields: [creatorListNotes.creatorId],
		references: [creatorProfiles.id],
	}),
	author: one(users, {
		fields: [creatorListNotes.authorId],
		references: [users.id],
	}),
}));

export const creatorListActivitiesRelations = relations(creatorListActivities, ({ one }) => ({
	list: one(creatorLists, {
		fields: [creatorListActivities.listId],
		references: [creatorLists.id],
	}),
	actor: one(users, {
		fields: [creatorListActivities.actorId],
		references: [users.id],
	}),
}));

export const listExportsRelations = relations(listExports, ({ one }) => ({
	list: one(creatorLists, {
		fields: [listExports.listId],
		references: [creatorLists.id],
	}),
	requestedByUser: one(users, {
		fields: [listExports.requestedBy],
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
export type JobCreator = typeof jobCreators.$inferSelect;
export type NewJobCreator = typeof jobCreators.$inferInsert;
export type ExportJob = typeof exportJobs.$inferSelect;
export type NewExportJob = typeof exportJobs.$inferInsert;
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
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewBackgroundJob = typeof backgroundJobs.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type PlanLimit = typeof planLimits.$inferSelect;
export type NewPlanLimit = typeof planLimits.$inferInsert;
export type CreatorProfile = typeof creatorProfiles.$inferSelect;
export type NewCreatorProfile = typeof creatorProfiles.$inferInsert;
export type CreatorList = typeof creatorLists.$inferSelect;
export type NewCreatorList = typeof creatorLists.$inferInsert;
export type CreatorListItem = typeof creatorListItems.$inferSelect;
export type NewCreatorListItem = typeof creatorListItems.$inferInsert;
export type CreatorListCollaborator = typeof creatorListCollaborators.$inferSelect;
export type NewCreatorListCollaborator = typeof creatorListCollaborators.$inferInsert;
export type CreatorListNote = typeof creatorListNotes.$inferSelect;
export type NewCreatorListNote = typeof creatorListNotes.$inferInsert;
export type CreatorListActivity = typeof creatorListActivities.$inferSelect;
export type NewCreatorListActivity = typeof creatorListActivities.$inferInsert;
export type ListExport = typeof listExports.$inferSelect;
export type NewListExport = typeof listExports.$inferInsert;

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
	// NOTE: currentPlan is NULL until user completes onboarding/payment
	// Plan enforcement should check for null and treat as "no plan" (0 limits)
	currentPlan: string | null;
	intendedPlan?: string | null;
	subscriptionStatus: string;
	// trialStatus removed - derive via deriveTrialStatus(subscriptionStatus, trialEndDate)
	trialStartDate?: Date | null;
	trialEndDate?: Date | null;
	subscriptionCancelDate?: Date | null;
	billingSyncStatus: string;

	// Billing data (minimal - Stripe Portal handles card/address)
	stripeCustomerId?: string | null;
	stripeSubscriptionId?: string | null;

	// Usage data
	planCampaignsLimit?: number | null;
	planCreatorsLimit?: number | null;
	planFeatures: unknown;
	usageCampaignsCurrent: number;
	usageCreatorsCurrentMonth: number;
	enrichmentsCurrentMonth: number;
	usageResetDate: Date;

	// System data
	signupTimestamp: Date;
	emailScheduleStatus: unknown;
	lastWebhookEvent?: string | null;
	lastWebhookTimestamp?: Date | null;

	// Timestamps
	createdAt: Date;
	updatedAt: Date;
};
