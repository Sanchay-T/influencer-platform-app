#!/usr/bin/env bash
# ============================================================================
# Validation: Search Security Fixes
# Task #3: Similar search trial bypass + Worker error classification
# ============================================================================
set -euo pipefail

PASS=0
FAIL=0
WARN=0

pass() { PASS=$((PASS + 1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $1"; }
warn() { WARN=$((WARN + 1)); echo "  WARN: $1"; }

echo "============================================"
echo "Search Security Fixes Validation"
echo "============================================"
echo ""

# ── Fix A: Trial search limit in similar-discovery ──────────────────────────
echo "--- Fix A: Trial search limit enforcement ---"

# Check similar-discovery route
if grep -q 'validateTrialSearchLimit' app/api/scraping/similar-discovery/route.ts; then
  pass "similar-discovery/route.ts has validateTrialSearchLimit"
else
  fail "similar-discovery/route.ts MISSING validateTrialSearchLimit"
fi

if grep -q "import.*validateTrialSearchLimit.*from '@/lib/billing'" app/api/scraping/similar-discovery/route.ts; then
  pass "similar-discovery/route.ts imports validateTrialSearchLimit"
else
  fail "similar-discovery/route.ts missing import for validateTrialSearchLimit"
fi

# Check instagram similar route
if grep -q 'validateTrialSearchLimit' app/api/scraping/instagram/route.ts; then
  pass "instagram/route.ts has validateTrialSearchLimit"
else
  fail "instagram/route.ts MISSING validateTrialSearchLimit"
fi

if grep -q "import.*validateTrialSearchLimit.*from '@/lib/billing'" app/api/scraping/instagram/route.ts; then
  pass "instagram/route.ts imports validateTrialSearchLimit"
else
  fail "instagram/route.ts missing import for validateTrialSearchLimit"
fi

# Check youtube-similar route
if grep -q 'validateTrialSearchLimit' app/api/scraping/youtube-similar/route.ts; then
  pass "youtube-similar/route.ts has validateTrialSearchLimit"
else
  fail "youtube-similar/route.ts MISSING validateTrialSearchLimit"
fi

if grep -q "import.*validateTrialSearchLimit.*from '@/lib/billing'" app/api/scraping/youtube-similar/route.ts; then
  pass "youtube-similar/route.ts imports validateTrialSearchLimit"
else
  fail "youtube-similar/route.ts missing import for validateTrialSearchLimit"
fi

# Verify trial check returns 403
for route in app/api/scraping/similar-discovery/route.ts app/api/scraping/instagram/route.ts app/api/scraping/youtube-similar/route.ts; do
  basename=$(echo "$route" | sed 's|app/api/scraping/||;s|/route.ts||')
  if grep -A5 'trialCheck' "$route" | grep -q '403'; then
    pass "$basename returns 403 on trial limit"
  else
    fail "$basename does NOT return 403 on trial limit"
  fi
done

echo ""

# ── Fix B: Worker error classification ──────────────────────────────────────
echo "--- Fix B: Worker error classification ---"

WORKER_FILE="app/api/v2/worker/search/route.ts"

if grep -q 'transientPatterns' "$WORKER_FILE"; then
  pass "Worker has transientPatterns array"
else
  fail "Worker MISSING transientPatterns classification"
fi

if grep -q 'isTransient' "$WORKER_FILE"; then
  pass "Worker classifies errors as transient/permanent"
else
  fail "Worker MISSING isTransient classification logic"
fi

if grep -q 'status: 503' "$WORKER_FILE"; then
  pass "Worker returns 503 for transient errors"
else
  fail "Worker does NOT return 503 for transient errors"
fi

# Verify specific transient patterns are covered
for pattern in timeout ECONNRESET ETIMEDOUT "rate limit" "socket hang up" 429 503; do
  if grep -q "$pattern" "$WORKER_FILE"; then
    pass "Worker covers transient pattern: $pattern"
  else
    warn "Worker missing transient pattern: $pattern"
  fi
done

echo ""
echo "============================================"
echo "Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
