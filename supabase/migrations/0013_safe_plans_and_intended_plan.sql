-- Create subscription_plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS "subscription_plans" (
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
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Ensure unique constraint on plan_key
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_plan_key_unique'
  ) THEN
    ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_plan_key_unique" UNIQUE ("plan_key");
  END IF;
END $$;
--> statement-breakpoint

-- Add intended_plan column to user_profiles if missing
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "intended_plan" varchar(50);
--> statement-breakpoint
