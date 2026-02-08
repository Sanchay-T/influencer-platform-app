#!/bin/bash
# SessionStart hook: Generate dynamic context for each session
# Writes to .claude/rules/context.md which Claude auto-reads

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

RULES_DIR="$CLAUDE_PROJECT_DIR/.claude/rules"
mkdir -p "$RULES_DIR"
OUT="$RULES_DIR/context.md"

# Current branch
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

# Git status
DIRTY_COUNT=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$DIRTY_COUNT" -eq 0 ]; then
  GIT_STATE="clean"
else
  GIT_STATE="dirty ($DIRTY_COUNT uncommitted files)"
fi

# Staged files
STAGED_COUNT=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')

# Node/pnpm versions
NODE_VER=$(node --version 2>/dev/null || echo "not found")
PNPM_VER=$(pnpm --version 2>/dev/null || echo "not found")

# Check if next dev is running
if pgrep -f "next dev" > /dev/null 2>&1; then
  DEV_SERVER="running"
else
  DEV_SERVER="not running"
fi

# Recent commits
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null || echo "no commits")

# Unpushed commits
UNPUSHED=$(git log --oneline @{u}..HEAD 2>/dev/null | wc -l | tr -d ' ')

cat > "$OUT" << EOF
# Session Context (auto-generated)

- **Branch:** $BRANCH
- **Git state:** $GIT_STATE
- **Staged files:** $STAGED_COUNT
- **Unpushed commits:** $UNPUSHED
- **Dev server:** $DEV_SERVER
- **Node:** $NODE_VER | **pnpm:** $PNPM_VER

## Recent Commits
\`\`\`
$RECENT_COMMITS
\`\`\`
EOF

echo '{"continue":true}'
