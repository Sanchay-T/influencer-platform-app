#!/bin/bash
# PostToolUse hook: Auto-lint files after Write/Edit

# Read JSON input from stdin
INPUT=$(cat)

# Extract file_path from the JSON (handles both Write and Edit tools)
FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path"\s*:\s*"[^"]+"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')

# If no file_path found, try target_file (alternate parameter name)
if [ -z "$FILE_PATH" ]; then
  FILE_PATH=$(echo "$INPUT" | grep -oE '"target_file"\s*:\s*"[^"]+"' | head -1 | sed 's/.*: *"//' | sed 's/"$//')
fi

# Only lint TypeScript/JavaScript files
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$(dirname "$FILE_PATH")"
  npx biome check --write "$FILE_PATH" 2>/dev/null || true
fi

exit 0

