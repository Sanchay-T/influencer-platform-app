-- Add trial system fields to user_profiles table
ALTER TABLE "user_profiles" ADD COLUMN "trial_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "trial_end_date" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "trial_status" varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "subscription_status" varchar(20) DEFAULT 'none';--> statement-breakpoint

-- Create indexes for better performance on trial queries
CREATE INDEX "idx_user_profiles_trial_status" ON "user_profiles" ("trial_status");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_trial_dates" ON "user_profiles" ("trial_start_date", "trial_end_date");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_stripe_customer" ON "user_profiles" ("stripe_customer_id");--> statement-breakpoint