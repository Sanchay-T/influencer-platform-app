-- Agregamos los campos necesarios para QStash
ALTER TABLE "scraping_jobs" ADD COLUMN "qstash_message_id" text;
ALTER TABLE "scraping_jobs" ADD COLUMN "processed_runs" integer DEFAULT 0 NOT NULL;
ALTER TABLE "scraping_jobs" ADD COLUMN "processed_results" integer DEFAULT 0 NOT NULL;
ALTER TABLE "scraping_jobs" ADD COLUMN "target_results" integer DEFAULT 1000 NOT NULL;
ALTER TABLE "scraping_jobs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL; 