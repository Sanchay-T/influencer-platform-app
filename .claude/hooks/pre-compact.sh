#!/bin/bash
# ============================================================================
# PRE-COMPACT HOOK — Agent Memory Persistence
# ============================================================================
# This hook runs before context compaction (auto or manual /compact).
# It marks the monologue.md file with a timestamp so the next agent instance
# knows exactly when context was cleared and can continue seamlessly.
# ============================================================================

set -e

# Get project root (where .claude folder lives)
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MONOLOGUE="$PROJECT_ROOT/agent_docs/monologue.md"
CURRENT_TASK="$PROJECT_ROOT/agent_docs/current-task.md"

# Timestamp for the compaction marker
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
DATE_HEADER=$(date "+%b %d, %Y — %I:%M %p")

# Read trigger type from stdin (JSON input from Claude Code)
if command -v jq &> /dev/null; then
    INPUT=$(cat)
    TRIGGER=$(echo "$INPUT" | jq -r '.trigger // "unknown"')
    CUSTOM_MSG=$(echo "$INPUT" | jq -r '.custom_instructions // ""')
else
    TRIGGER="unknown"
    CUSTOM_MSG=""
fi

# Append compaction marker to monologue
if [ -f "$MONOLOGUE" ]; then
    cat >> "$MONOLOGUE" << EOF

---

### Context Compacted — $DATE_HEADER

**Trigger:** $TRIGGER
**Timestamp:** $TIMESTAMP
EOF

    # Add custom instructions if provided (from /compact "message")
    if [ -n "$CUSTOM_MSG" ] && [ "$CUSTOM_MSG" != "" ]; then
        echo "**User note:** $CUSTOM_MSG" >> "$MONOLOGUE"
    fi

    echo "" >> "$MONOLOGUE"
    echo "*The session above was interrupted. Next agent: Read 'Active Context' section above, then check current-task.md for immediate next steps.*" >> "$MONOLOGUE"
    echo "" >> "$MONOLOGUE"
fi

# Output success message for Claude Code
cat << 'EOF'
{
  "continue": true,
  "systemMessage": "Context compacting. Monologue updated with timestamp. Next session will read agent_docs/monologue.md for continuity."
}
EOF
