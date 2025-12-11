#!/bin/bash
# File Length — Simple warning, no AI
MAX=300

INPUT=$(cat)
FILE=$(echo "$INPUT" | grep -o '"file_path":\s*"[^"]*"' | sed 's/.*: *"//;s/"$//' || \
       echo "$INPUT" | grep -o '"path":\s*"[^"]*"' | sed 's/.*: *"//;s/"$//')

[ -z "$FILE" ] || [ ! -f "$FILE" ] && echo '{"continue":true}' && exit 0

# Skip non-code
case "$FILE" in *.md|*.json|*.lock|*.css|*.yaml|*.yml|*.env*) echo '{"continue":true}'; exit 0;; esac

LINES=$(wc -l < "$FILE" | tr -d ' ')
NAME=$(basename "$FILE")

if [ "$LINES" -gt "$MAX" ]; then
  OVER=$((LINES - MAX))
  echo "{\"continue\":true,\"warning\":\"⚠️ $NAME: $LINES lines (+$OVER over limit). Split this file.\"}"
elif [ "$LINES" -gt 250 ]; then
  echo "{\"continue\":true,\"warning\":\"📊 $NAME: $LINES/$MAX lines\"}"
else
  echo '{"continue":true}'
fi
