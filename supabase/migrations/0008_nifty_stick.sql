ALTER TABLE "user_profiles" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "company_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "industry" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "signup_timestamp" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "onboarding_step" varchar(50) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "business_name" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "brand_description" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "email_schedule_status" jsonb DEFAULT '{}';