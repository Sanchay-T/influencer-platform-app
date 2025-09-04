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

ALTER TABLE "user_profiles" DROP COLUMN "clerk_customer_id";
ALTER TABLE "user_profiles" DROP COLUMN "clerk_subscription_id";