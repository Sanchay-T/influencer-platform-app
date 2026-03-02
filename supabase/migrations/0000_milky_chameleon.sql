CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"qstash_message_id" text,
	"priority" integer DEFAULT 100 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"scheduled_for" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"error" text,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"search_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "creator_list_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "creator_list_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"user_id" uuid,
	"invite_email" text,
	"role" varchar(16) DEFAULT 'viewer' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"invitation_token" text,
	"invited_by" uuid,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_list_collaborators_user_list_unique" UNIQUE("list_id","user_id"),
	CONSTRAINT "creator_list_collaborators_invite_unique" UNIQUE("list_id","invite_email")
);

CREATE TABLE "creator_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"bucket" varchar(32) DEFAULT 'backlog' NOT NULL,
	"added_by" uuid,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"metrics_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"last_contacted_at" timestamp,
	CONSTRAINT "creator_list_items_list_creator_unique" UNIQUE("list_id","creator_id")
);

CREATE TABLE "creator_list_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"creator_id" uuid,
	"author_id" uuid,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "creator_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" varchar(24) DEFAULT 'custom' NOT NULL,
	"privacy" varchar(16) DEFAULT 'private' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"slug" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_shared_at" timestamp
);

CREATE TABLE "creator_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" varchar(32) NOT NULL,
	"external_id" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"url" text,
	"followers" integer,
	"engagement_rate" numeric,
	"category" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_profiles_platform_external_unique" UNIQUE("platform","external_id")
);

CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_id" text NOT NULL,
	"aggregate_type" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_version" integer DEFAULT 1 NOT NULL,
	"event_data" jsonb NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"processing_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"idempotency_key" text NOT NULL,
	"source_system" varchar(50) NOT NULL,
	"correlation_id" text,
	"causation_id" text,
	CONSTRAINT "events_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"campaign_id" uuid,
	"job_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_creators" integer,
	"download_url" text,
	"expires_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

CREATE TABLE "job_creator_keys" (
	"job_id" uuid NOT NULL,
	"creator_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_creator_keys_job_id_creator_key_pk" PRIMARY KEY("job_id","creator_key")
);

CREATE TABLE "job_creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"platform" varchar(50) NOT NULL,
	"username" varchar(255) NOT NULL,
	"creator_data" jsonb NOT NULL,
	"enriched" boolean DEFAULT false NOT NULL,
	"keyword" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_creators_unique" UNIQUE("job_id","platform","username")
);

CREATE TABLE "list_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"requested_by" uuid,
	"format" varchar(16) DEFAULT 'csv' NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"file_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

CREATE TABLE "plan_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_key" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"monthly_price" integer NOT NULL,
	"yearly_price" integer NOT NULL,
	"creators_per_month" integer NOT NULL,
	"enrichments_per_month" integer NOT NULL,
	"campaigns_limit" integer NOT NULL,
	"features" jsonb NOT NULL,
	"is_legacy" boolean DEFAULT false NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_limits_plan_key_unique" UNIQUE("plan_key")
);

CREATE TABLE "scraping_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"run_id" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"keywords" jsonb,
	"platform" varchar(50) DEFAULT 'Tiktok' NOT NULL,
	"region" varchar(10) DEFAULT 'US' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"timeout_at" timestamp,
	"campaign_id" uuid,
	"target_username" text,
	"search_params" jsonb,
	"qstash_message_id" text,
	"processed_runs" integer DEFAULT 0 NOT NULL,
	"processed_results" integer DEFAULT 0 NOT NULL,
	"target_results" integer DEFAULT 1000 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cursor" integer DEFAULT 0,
	"progress" numeric DEFAULT '0',
	"keywords_dispatched" integer DEFAULT 0,
	"keywords_completed" integer DEFAULT 0,
	"creators_found" integer DEFAULT 0,
	"creators_enriched" integer DEFAULT 0,
	"enrichment_status" varchar(20) DEFAULT 'pending',
	"expansion_round" integer DEFAULT 1,
	"used_keywords" jsonb
);

CREATE TABLE "scraping_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"creators" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "search_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" uuid,
	"platform" varchar(20) NOT NULL,
	"search_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"total_count" integer NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

CREATE TABLE "search_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"platform" varchar(20) NOT NULL,
	"profile_url" text,
	"post_url" text,
	"post_description" text,
	"avatar_url" text,
	"followers" integer DEFAULT 0,
	"is_verified" varchar(10) DEFAULT 'false',
	"email" text,
	"bio" text,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_key" varchar(50) NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"monthly_price" integer NOT NULL,
	"yearly_price" integer,
	"stripe_monthly_price_id" text NOT NULL,
	"stripe_yearly_price_id" text,
	"campaigns_limit" integer NOT NULL,
	"creators_limit" integer NOT NULL,
	"features" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_plan_key_unique" UNIQUE("plan_key")
);

CREATE TABLE "system_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"value_type" varchar(20) NOT NULL,
	"description" text,
	"is_hot_reloadable" varchar(5) DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_configurations_category_key_unique" UNIQUE("category","key")
);

CREATE TABLE "user_billing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_billing_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);

CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_plan" varchar(50),
	"intended_plan" varchar(50),
	"subscription_status" varchar(20) DEFAULT 'none' NOT NULL,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"subscription_cancel_date" timestamp,
	"billing_interval" varchar(10),
	"current_period_end" timestamp,
	"billing_sync_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_system_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"signup_timestamp" timestamp DEFAULT now() NOT NULL,
	"email_schedule_status" jsonb DEFAULT '{}' NOT NULL,
	"last_webhook_event" varchar(100),
	"last_webhook_timestamp" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_campaigns_limit" integer,
	"plan_creators_limit" integer,
	"plan_features" jsonb DEFAULT '{}' NOT NULL,
	"usage_campaigns_current" integer DEFAULT 0 NOT NULL,
	"usage_creators_current_month" integer DEFAULT 0 NOT NULL,
	"enrichments_current_month" integer DEFAULT 0 NOT NULL,
	"usage_reset_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email" text,
	"full_name" text,
	"business_name" text,
	"brand_description" text,
	"industry" text,
	"onboarding_step" varchar(50) DEFAULT 'pending' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"source" varchar(20) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"event_timestamp" timestamp,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"metadata" jsonb,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);

ALTER TABLE "creator_list_activities" ADD CONSTRAINT "creator_list_activities_list_id_creator_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."creator_lists"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "creator_list_activities" ADD CONSTRAINT "creator_list_activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "creator_list_collaborators" ADD CONSTRAINT "creator_list_collaborators_list_id_creator_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."creator_lists"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "creator_list_collaborators" ADD CONSTRAINT "creator_list_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "creator_list_collaborators" ADD CONSTRAINT "creator_list_collaborators_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "creator_list_items" ADD CONSTRAINT "creator_list_items_list_id_creator_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."creator_lists"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "creator_list_items" ADD CONSTRAINT "creator_list_items_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "creator_list_items" ADD CONSTRAINT "creator_list_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "creator_list_notes" ADD CONSTRAINT "creator_list_notes_list_id_creator_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."creator_lists"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "creator_list_notes" ADD CONSTRAINT "creator_list_notes_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "creator_list_notes" ADD CONSTRAINT "creator_list_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "creator_lists" ADD CONSTRAINT "creator_lists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_job_id_scraping_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scraping_jobs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "job_creator_keys" ADD CONSTRAINT "job_creator_keys_job_id_scraping_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scraping_jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "job_creators" ADD CONSTRAINT "job_creators_job_id_scraping_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scraping_jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "list_exports" ADD CONSTRAINT "list_exports_list_id_creator_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."creator_lists"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "list_exports" ADD CONSTRAINT "list_exports_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "scraping_results" ADD CONSTRAINT "scraping_results_job_id_scraping_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scraping_jobs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "search_jobs" ADD CONSTRAINT "search_jobs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_job_id_search_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."search_jobs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_billing" ADD CONSTRAINT "user_billing_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_system_data" ADD CONSTRAINT "user_system_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_usage" ADD CONSTRAINT "user_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_background_jobs_status" ON "background_jobs" USING btree ("status");
CREATE INDEX "idx_background_jobs_job_type_status" ON "background_jobs" USING btree ("job_type","status");
CREATE INDEX "idx_background_jobs_scheduled_for" ON "background_jobs" USING btree ("scheduled_for");
CREATE INDEX "idx_campaigns_user_id" ON "campaigns" USING btree ("user_id");
CREATE INDEX "idx_campaigns_user_status" ON "campaigns" USING btree ("user_id","status");
CREATE INDEX "idx_creator_lists_owner" ON "creator_lists" USING btree ("owner_id");
CREATE INDEX "idx_creator_lists_owner_archived" ON "creator_lists" USING btree ("owner_id","is_archived");
CREATE INDEX "idx_events_aggregate_id" ON "events" USING btree ("aggregate_id");
CREATE INDEX "idx_events_aggregate_id_type" ON "events" USING btree ("aggregate_id","aggregate_type");
CREATE INDEX "idx_events_event_type" ON "events" USING btree ("event_type");
CREATE INDEX "idx_events_processing_status" ON "events" USING btree ("processing_status");
CREATE INDEX "idx_export_jobs_user_id" ON "export_jobs" USING btree ("user_id");
CREATE INDEX "idx_export_jobs_status" ON "export_jobs" USING btree ("status");
CREATE INDEX "idx_job_creators_job_id" ON "job_creators" USING btree ("job_id");
CREATE INDEX "idx_job_creators_enriched" ON "job_creators" USING btree ("job_id","enriched");
CREATE INDEX "idx_job_creators_keyword" ON "job_creators" USING btree ("job_id","keyword");
CREATE INDEX "idx_plan_limits_plan_key" ON "plan_limits" USING btree ("plan_key");
CREATE INDEX "idx_plan_limits_visible" ON "plan_limits" USING btree ("is_visible","display_order");
CREATE INDEX "idx_scraping_jobs_user_status" ON "scraping_jobs" USING btree ("user_id","status");
CREATE INDEX "idx_scraping_jobs_user_created" ON "scraping_jobs" USING btree ("user_id","created_at");
CREATE INDEX "idx_scraping_results_job_id" ON "scraping_results" USING btree ("job_id");
CREATE INDEX "idx_users_user_id" ON "users" USING btree ("user_id");
CREATE INDEX "idx_webhook_events_status" ON "webhook_events" USING btree ("status");
CREATE INDEX "idx_webhook_events_status_created_at" ON "webhook_events" USING btree ("status","created_at");