-- Creator list infrastructure
CREATE TABLE IF NOT EXISTS "creator_profiles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "platform" varchar(32) NOT NULL,
    "external_id" text NOT NULL,
    "handle" text NOT NULL,
    "display_name" text,
    "avatar_url" text,
    "url" text,
    "followers" integer,
    "engagement_rate" numeric,
    "category" text,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "creator_profiles"
  ADD CONSTRAINT "creator_profiles_platform_external_unique" UNIQUE ("platform", "external_id");

CREATE TABLE IF NOT EXISTS "creator_lists" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "owner_id" uuid NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "type" varchar(24) DEFAULT 'custom'::varchar NOT NULL,
    "privacy" varchar(16) DEFAULT 'private'::varchar NOT NULL,
    "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "slug" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "last_shared_at" timestamp
);

ALTER TABLE "creator_lists"
  ADD CONSTRAINT "creator_lists_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE cascade;

CREATE TABLE IF NOT EXISTS "creator_list_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "list_id" uuid NOT NULL,
    "creator_id" uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "bucket" varchar(32) DEFAULT 'backlog'::varchar NOT NULL,
    "added_by" uuid,
    "added_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "notes" text,
    "metrics_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "last_contacted_at" timestamp
);

ALTER TABLE "creator_list_items"
  ADD CONSTRAINT "creator_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "creator_lists"("id") ON DELETE cascade;
ALTER TABLE "creator_list_items"
  ADD CONSTRAINT "creator_list_items_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("id") ON DELETE cascade;
ALTER TABLE "creator_list_items"
  ADD CONSTRAINT "creator_list_items_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "creator_list_items"
  ADD CONSTRAINT "creator_list_items_list_creator_unique" UNIQUE ("list_id", "creator_id");

CREATE TABLE IF NOT EXISTS "creator_list_collaborators" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "list_id" uuid NOT NULL,
    "user_id" uuid,
    "invite_email" text,
    "role" varchar(16) DEFAULT 'viewer'::varchar NOT NULL,
    "status" varchar(16) DEFAULT 'pending'::varchar NOT NULL,
    "invitation_token" text,
    "invited_by" uuid,
    "last_seen_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "creator_list_collaborators"
  ADD CONSTRAINT "creator_list_collaborators_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "creator_lists"("id") ON DELETE cascade;
ALTER TABLE "creator_list_collaborators"
  ADD CONSTRAINT "creator_list_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "creator_list_collaborators"
  ADD CONSTRAINT "creator_list_collaborators_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "creator_list_collaborators"
  ADD CONSTRAINT "creator_list_collaborators_user_list_unique" UNIQUE ("list_id", "user_id");
ALTER TABLE "creator_list_collaborators"
  ADD CONSTRAINT "creator_list_collaborators_invite_unique" UNIQUE ("list_id", "invite_email");

CREATE TABLE IF NOT EXISTS "creator_list_notes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "list_id" uuid NOT NULL,
    "creator_id" uuid,
    "author_id" uuid,
    "body" text NOT NULL,
    "is_internal" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "creator_list_notes"
  ADD CONSTRAINT "creator_list_notes_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "creator_lists"("id") ON DELETE cascade;
ALTER TABLE "creator_list_notes"
  ADD CONSTRAINT "creator_list_notes_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("id") ON DELETE cascade;
ALTER TABLE "creator_list_notes"
  ADD CONSTRAINT "creator_list_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE set null;

CREATE TABLE IF NOT EXISTS "creator_list_activities" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "list_id" uuid NOT NULL,
    "actor_id" uuid,
    "action" varchar(64) NOT NULL,
    "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "creator_list_activities"
  ADD CONSTRAINT "creator_list_activities_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "creator_lists"("id") ON DELETE cascade;
ALTER TABLE "creator_list_activities"
  ADD CONSTRAINT "creator_list_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE set null;

CREATE TABLE IF NOT EXISTS "list_exports" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "list_id" uuid NOT NULL,
    "requested_by" uuid,
    "format" varchar(16) DEFAULT 'csv'::varchar NOT NULL,
    "status" varchar(16) DEFAULT 'queued'::varchar NOT NULL,
    "file_url" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "completed_at" timestamp
);

ALTER TABLE "list_exports"
  ADD CONSTRAINT "list_exports_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "creator_lists"("id") ON DELETE cascade;
ALTER TABLE "list_exports"
  ADD CONSTRAINT "list_exports_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE set null;

CREATE INDEX IF NOT EXISTS "creator_lists_owner_idx" ON "creator_lists" ("owner_id");
CREATE INDEX IF NOT EXISTS "creator_lists_privacy_idx" ON "creator_lists" ("privacy");
CREATE INDEX IF NOT EXISTS "creator_list_items_list_idx" ON "creator_list_items" ("list_id");
CREATE INDEX IF NOT EXISTS "creator_list_items_creator_idx" ON "creator_list_items" ("creator_id");
CREATE INDEX IF NOT EXISTS "creator_list_collaborators_list_idx" ON "creator_list_collaborators" ("list_id");
