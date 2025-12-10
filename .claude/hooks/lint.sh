#!/bin/bash
# PostToolUse hook: Auto-lint files after Write/Edit/mcp__morph-mcp__edit_file

# Read JSON from stdin
INPUT=$(cat)

# Extract file_path from JSON using jq
# Try tool_input.file_path first, then tool_input.path, then tool_response.filePath
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // .tool_response.filePath // empty' 2>/dev/null)

# Debug: Uncomment to log hook activity
# echo "[lint.sh] $(date) FILE_PATH=$FILE_PATH" >> /tmp/claude-hook-debug.log

# Exit if no file path found
if [ -z "$FILE_PATH" ] || [ "$FILE_PATH" = "null" ]; then
  exit 0
fi

# Only lint TypeScript/JavaScript files
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  # Change to project directory if available
  if [ -n "$CLAUDE_PROJECT_DIR" ]; then
    cd "$CLAUDE_PROJECT_DIR"
  fi

  # Run biome check with --write to auto-fix issues
  npx biome check --write "$FILE_PATH" 2>/dev/null || true
fi

exit 0
