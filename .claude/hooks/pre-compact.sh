#!/bin/bash
# ============================================================================
# PRE-COMPACT — Save State Before Context Clears
# ============================================================================
# Uses SONNET to update:
# 1. tasks.md — Checklist + exact next action (PRIMARY)
# 2. monologue.md — Just adds compaction marker (SECONDARY)
#
# The agent after compact reads tasks.md to know exactly what to do.
# ============================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TASKS="$PROJECT_ROOT/agent_docs/tasks.md"
MONOLOGUE="$PROJECT_ROOT/agent_docs/monologue.md"
CURRENT_TASK="$PROJECT_ROOT/agent_docs/current-task.md"
NOW=$(date "+%b %d, %Y — %I:%M %p")

# Parse trigger
TRIGGER=$(cat | grep -o '"trigger":\s*"[^"]*"' | sed 's/.*: *"//;s/"$//' || echo "unknown")

# Gather context
TASKS_CONTENT=$(cat "$TASKS" 2>/dev/null)
CURRENT_TASK_CONTENT=$(head -100 "$CURRENT_TASK" 2>/dev/null)
RECENT_COMMITS=$(cd "$PROJECT_ROOT" && git log --oneline -10 2>/dev/null)
MODIFIED_FILES=$(cd "$PROJECT_ROOT" && git status --porcelain 2>/dev/null | head -30)

# Use SONNET to update tasks.md
if command -v claude &> /dev/null; then
  claude -p "CRITICAL: Context is about to clear. Update the task state so the next agent knows exactly what to do.

## Update this file: $TASKS

## Current State of tasks.md:
$TASKS_CONTENT

## Recent Context:

### Modified Files (uncommitted work):
$MODIFIED_FILES

### Recent Commits:
$RECENT_COMMITS

### Current Task Details:
$CURRENT_TASK_CONTENT

## Your Job:
1. Update the **Checklist** — Mark any completed items with [x]
2. Update **Next Action** — Write the EXACT next step (file to open, function to edit, what to do)
3. Update **Context** section — Branch, blockers, anything the next agent needs
4. Update the **Updated:** date to: $NOW

## Rules:
- Be SPECIFIC in Next Action (file paths, line numbers, function names)
- The next agent has ZERO memory — tell them exactly what to do
- Keep the checklist structure intact
- Use Edit tool to update the file" \
    --model sonnet --allowedTools "Edit,Read" --max-turns 5 2>/dev/null || true
fi

# Add compaction marker to monologue (simple, no AI needed)
[ -f "$MONOLOGUE" ] && cat >> "$MONOLOGUE" << EOF

---
### Context Compacted — $NOW
**Trigger:** $TRIGGER
*State saved to tasks.md. Read it to continue.*

EOF

echo '{"continue":true,"systemMessage":"✅ State saved to tasks.md"}'
