ALTER TABLE "scraping_jobs" ADD COLUMN "target_username" text;--> statement-breakpoint
ALTER TABLE "scraping_jobs" ADD COLUMN "search_params" jsonb;