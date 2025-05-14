CREATE TABLE "scraping_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"run_id" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"keywords" jsonb NOT NULL,
	"platform" varchar(50) DEFAULT 'Tiktok' NOT NULL,
	"region" varchar(10) DEFAULT 'US' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"timeout_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "scraping_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"creators" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scraping_results" ADD CONSTRAINT "scraping_results_job_id_scraping_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scraping_jobs"("id") ON DELETE no action ON UPDATE no action;