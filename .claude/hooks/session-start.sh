#!/bin/bash
# Session Start — Show current task from tasks.md
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TASKS="$PROJECT_ROOT/agent_docs/tasks.md"

BRANCH=$(cd "$PROJECT_ROOT" && git branch --show-current 2>/dev/null || echo "?")
UNCOMMITTED=$(cd "$PROJECT_ROOT" && git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

# Extract current task info
TASK_TITLE=$(grep "^\*\*Title:\*\*" "$TASKS" 2>/dev/null | head -1 | sed 's/\*\*Title:\*\* //')
TASK_STATUS=$(grep "^\*\*Status:\*\*" "$TASKS" 2>/dev/null | head -1 | sed 's/\*\*Status:\*\* //')
NEXT_ACTION=$(sed -n '/^### Next Action/,/^###/p' "$TASKS" 2>/dev/null | grep -v "^###" | head -3 | tr '\n' ' ')

cat << EOF
{
  "continue": true,
  "systemMessage": "📋 **$TASK_TITLE**\n$TASK_STATUS | $BRANCH | $UNCOMMITTED uncommitted\n\n▶️ Next: $NEXT_ACTION\n\n*Read agent_docs/tasks.md for full context*"
}
EOF
