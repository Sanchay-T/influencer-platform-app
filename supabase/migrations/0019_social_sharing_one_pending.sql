-- Enforce at most one pending submission per user via partial unique index.
-- This prevents the check-then-insert race in submitLink()/submitImage().
-- Drizzle schema builder doesn't support partial unique indexes, so this
-- is managed via migration only (documented in schema.ts).

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_social_sharing_one_pending_per_user
ON social_sharing_submissions (user_id)
WHERE status = 'pending';
