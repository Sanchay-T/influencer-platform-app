-- Temp migration to validate remote + local application
CREATE TABLE IF NOT EXISTS temp_migrate_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note text,
  created_at timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
