#!/usr/bin/env bash
set -euo pipefail

# Load worktree-specific environment variables if present
if [ -f ./.env.worktree ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env.worktree
  set +a
fi

# Prefer explicit PORT, else LOCAL_PORT, else default 3000
PORT_TO_USE="${PORT:-${LOCAL_PORT:-3000}}"

echo "Starting Next.js dev server on port ${PORT_TO_USE} (LOCAL_PORT=${LOCAL_PORT:-unset})"

exec npx next dev -p "${PORT_TO_USE}"

