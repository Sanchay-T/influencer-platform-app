#!/bin/bash
# PreToolUse hook: Run typecheck + biome check BEFORE git commit
# Catches type errors and lint issues before they're committed.
# Adds warning context — does NOT block the commit.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only intercept git commit commands
if [[ ! "$COMMAND" =~ git[[:space:]]+commit ]]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

WARNINGS=""

# Run typecheck
TYPECHECK_OUTPUT=$(pnpm typecheck 2>&1)
TYPECHECK_EXIT=$?
if [ $TYPECHECK_EXIT -ne 0 ]; then
  TYPECHECK_TAIL=$(echo "$TYPECHECK_OUTPUT" | tail -15)
  WARNINGS="TypeScript errors found — fix before committing:\n${TYPECHECK_TAIL}"
fi

# Run biome check (without --write, just check)
BIOME_OUTPUT=$(npx biome check . --max-diagnostics=10 2>&1)
BIOME_EXIT=$?
if [ $BIOME_EXIT -ne 0 ]; then
  BIOME_TAIL=$(echo "$BIOME_OUTPUT" | tail -15)
  if [ -n "$WARNINGS" ]; then
    WARNINGS="${WARNINGS}\n\n"
  fi
  WARNINGS="${WARNINGS}Biome lint issues found:\n${BIOME_TAIL}"
fi

if [ -n "$WARNINGS" ]; then
  ESCAPED=$(printf '%s' "$WARNINGS" | jq -Rs .)
  echo "{\"decision\":\"warn\",\"message\":$ESCAPED}"
else
  exit 0
fi
