#!/bin/bash
# Tech Junk Scanner
# Run with: ./scripts/scan-tech-junk.sh

echo "🔍 Tech Junk Scanner"
echo "===================="
echo ""

# Exclude patterns
EXCLUDE="--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=testing --exclude-dir=scripts --exclude-dir=__tests__"

echo "🔴 CRITICAL: Debug console.logs with prefixes"
echo "----------------------------------------------"
grep -rn $EXCLUDE --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  -E "console\.(log|warn|error).*\[(GEMZ|DEBUG|DIAGNOSTIC|TEST)" . 2>/dev/null | head -20
echo ""

echo "🔴 CRITICAL: Hardcoded test-user (excluding dev utils)"
echo "-------------------------------------------------------"
grep -rn $EXCLUDE --include="*.ts" --include="*.tsx" \
  "userId.*test-user" . 2>/dev/null | grep -v "runStandalone\|test-context\|test-utils" | head -10
echo ""

echo "🟠 HIGH: Test emails in code"
echo "----------------------------"
grep -rn $EXCLUDE --include="*.ts" --include="*.tsx" \
  -E "test@example\.com|test@usegems\.io" . 2>/dev/null | head -10
echo ""

echo "🟡 MEDIUM: Console.logs with emojis (often debug)"
echo "--------------------------------------------------"
grep -rn $EXCLUDE --include="*.ts" --include="*.tsx" --include="*.jsx" \
  -E "console\.log.*[📊🔍🚀✅❌🎯📡]" . 2>/dev/null | head -10
echo ""

echo "🟢 LOW: TODO/FIXME comments"
echo "---------------------------"
grep -rn $EXCLUDE --include="*.ts" --include="*.tsx" \
  -E "TODO:|FIXME:|HACK:|XXX:" . 2>/dev/null | head -15
echo ""

echo "📁 Debug files in repo"
echo "----------------------"
find . -name "debug-*.png" -o -name "debug-*.json" -o -name "*.bak" -o -name "*.tmp" 2>/dev/null | grep -v node_modules | head -10
echo ""

echo "✅ Scan complete!"
echo ""
echo "To fix:"
echo "  - Remove debug console.logs"
echo "  - Delete debug files: rm -f debug-* *.bak"
echo "  - Review TODOs for stale items"
