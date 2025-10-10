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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"company_name" text NOT NULL,
	"industry" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    EXECUTE 'ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY';
  END IF;
END $$;--> statement-breakpoint
DROP TABLE IF EXISTS "notifications" CASCADE;--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "scraping_jobs" ALTER COLUMN "target_results" SET DEFAULT 1000;--> statement-breakpoint
ALTER TABLE "search_jobs" ADD CONSTRAINT "search_jobs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_job_id_search_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."search_jobs"("id") ON DELETE no action ON UPDATE no action;
