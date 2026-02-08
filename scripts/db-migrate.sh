#!/bin/bash
# Run Drizzle migrations against the target environment.
#
# Usage:
#   ./scripts/db-migrate.sh              # defaults to local (.env.local)
#   DRIZZLE_ENV=production ./scripts/db-migrate.sh
#
# Workflow:
#   1. Edit lib/db/schema.ts
#   2. npx drizzle-kit generate     → creates migration SQL + snapshot
#   3. Review the generated SQL     → make sure it's not destructive
#   4. npx drizzle-kit migrate      → applies to local DB (or use this script)
#   5. git add supabase/migrations/ → commit the migration
#   6. On deploy: DRIZZLE_ENV=production ./scripts/db-migrate.sh

set -euo pipefail

echo "Running Drizzle migrations (DRIZZLE_ENV=${DRIZZLE_ENV:-local})..."
npx drizzle-kit migrate
echo "Migrations complete."
