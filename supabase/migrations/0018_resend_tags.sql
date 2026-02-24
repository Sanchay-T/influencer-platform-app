-- USE2-79: Add resend_tags column for broadcast segmentation tagging
-- Tags are stored locally because Resend SDK doesn't support native contact tags
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS resend_tags text[] NOT NULL DEFAULT ARRAY[]::text[];
