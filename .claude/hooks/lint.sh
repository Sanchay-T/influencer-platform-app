#!/bin/bash
# PostToolUse hook: Auto-lint files after Write/Edit

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // .tool_response.filePath // empty' 2>/dev/null)

# Exit silently if no file
if [ -z "$FILE_PATH" ] || [ "$FILE_PATH" = "null" ]; then
  echo '{"continue":true}'
  exit 0
fi

# Only lint TS/JS files
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  if [ -n "$CLAUDE_PROJECT_DIR" ]; then
    cd "$CLAUDE_PROJECT_DIR"
  fi
  npx biome check --write "$FILE_PATH" 2>/dev/null || true
fi

echo '{"continue":true}'
