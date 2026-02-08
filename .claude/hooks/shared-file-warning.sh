#!/bin/bash
# PreToolUse hook: Warn before editing critical/shared files

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

# Exit silently if no file path
if [ -z "$FILE_PATH" ] || [ "$FILE_PATH" = "null" ]; then
  exit 0
fi

# Get just the filename and relative path
BASENAME=$(basename "$FILE_PATH")
# Make path relative to project dir for pattern matching
REL_PATH="${FILE_PATH#$CLAUDE_PROJECT_DIR/}"

WARNING=""

case "$REL_PATH" in
  # Database schema
  lib/db/schema.ts|lib/db/schema/*)
    WARNING="DB SCHEMA file — changes here require a migration. Make sure to run 'pnpm drizzle-kit generate' after."
    ;;
  drizzle.config.ts)
    WARNING="Drizzle config — affects all database operations and migrations."
    ;;
  # Dependencies
  package.json)
    WARNING="Package manifest — adding/removing deps affects the whole project. Run 'pnpm install' after."
    ;;
  pnpm-lock.yaml)
    WARNING="Lock file — this should only change via 'pnpm install', not manual edits."
    ;;
  # Build/tooling config
  next.config.ts|next.config.js|next.config.mjs)
    WARNING="Next.js config — affects build, routing, and deployment. Test with 'pnpm build' after."
    ;;
  tsconfig.json|tsconfig.*.json)
    WARNING="TypeScript config — affects type checking across the entire project."
    ;;
  biome.json)
    WARNING="Biome config — affects linting and formatting rules for all files."
    ;;
  # CI/CD
  .github/workflows/*)
    WARNING="CI/CD workflow — changes affect automated pipelines. Test carefully."
    ;;
  # Auth/routing middleware
  middleware.ts)
    WARNING="Auth/routing middleware — affects every request. Changes can break auth or routing."
    ;;
  # Vercel config
  vercel.json)
    WARNING="Vercel deployment config — affects production deployment behavior."
    ;;
esac

if [ -n "$WARNING" ]; then
  ESCAPED=$(echo "$WARNING" | jq -Rs .)
  echo "{\"decision\":\"warn\",\"message\":$ESCAPED}"
else
  exit 0
fi
