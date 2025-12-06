#!/usr/bin/env bash
set -euo pipefail

# Compares the live DB schema (DATABASE_URL) to the repo baseline + migrations.
# Requires: pg_dump v17+, DATABASE_URL, and the baseline at supabase/migrations/0200_baseline_schema.sql
# Exits non-zero on drift.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASELINE="$ROOT_DIR/supabase/migrations/0200_baseline_schema.sql"
WORKDIR="$ROOT_DIR/supabase/tmp-drift"
DUMPFILE="$WORKDIR/live-schema.sql"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set" >&2
  exit 1
fi

mkdir -p "$WORKDIR"

# Dump live schema
/opt/homebrew/opt/postgresql@17/bin/pg_dump \
  --schema-only --no-owner --no-privileges \
  "${DATABASE_URL%\?pgbouncer=true}"?sslmode=require \
  -f "$DUMPFILE"

# Normalize CRLF and sort CREATE lines lightly (cheap normalization)
normalize() {
  sed 's/\r$//' "$1" \
    | sed '/^--/d' \
    | sed '/^\\restrict /d' \
    | sed '/^\\unrestrict /d'
}

DIFF_OUTPUT=$(diff -u <(normalize "$BASELINE") <(normalize "$DUMPFILE") || true)

if [[ -n "$DIFF_OUTPUT" ]]; then
  echo "Schema drift detected between baseline and live DB:" >&2
  echo "$DIFF_OUTPUT" >&2
  exit 1
fi

echo "✔ No schema drift vs baseline"
