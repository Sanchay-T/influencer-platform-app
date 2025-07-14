-- Add Clerk billing fields to user_profiles table
ALTER TABLE "user_profiles" ADD COLUMN "clerk_customer_id" text;
ALTER TABLE "user_profiles" ADD COLUMN "clerk_subscription_id" text;
ALTER TABLE "user_profiles" ADD COLUMN "current_plan" varchar(20) DEFAULT 'free';