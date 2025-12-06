CREATE TABLE "user_billing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"payment_method_id" text,
	"card_last_4" varchar(4),
	"card_brand" varchar(20),
	"card_exp_month" integer,
	"card_exp_year" integer,
	"billing_address_city" text,
	"billing_address_country" varchar(2),
	"billing_address_postal_code" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_billing_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);

CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_plan" varchar(50) DEFAULT 'free' NOT NULL,
	"intended_plan" varchar(50),
	"subscription_status" varchar(20) DEFAULT 'none' NOT NULL,
	"trial_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"trial_conversion_date" timestamp,
	"subscription_cancel_date" timestamp,
	"subscription_renewal_date" timestamp,
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

ALTER TABLE "user_billing" ADD CONSTRAINT "user_billing_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_system_data" ADD CONSTRAINT "user_system_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_usage" ADD CONSTRAINT "user_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;