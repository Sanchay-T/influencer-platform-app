#!/usr/bin/env bash
# Validation script for webhook + usage race condition fixes
set -euo pipefail

PASS=0
FAIL=0

check() {
  local desc="$1"
  local result="$2"
  if [ "$result" = "pass" ]; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Fix A: Stale webhook rejection removed ==="

# STALE_THRESHOLD_SECONDS should not exist in webhook route
if grep -q 'STALE_THRESHOLD_SECONDS' app/api/stripe/webhook/route.ts 2>/dev/null; then
  check "STALE_THRESHOLD_SECONDS removed from webhook route" "fail"
else
  check "STALE_THRESHOLD_SECONDS removed from webhook route" "pass"
fi

# isEventStale should not be imported in webhook route
if grep -q 'isEventStale' app/api/stripe/webhook/route.ts 2>/dev/null; then
  check "isEventStale import removed from webhook route" "fail"
else
  check "isEventStale import removed from webhook route" "pass"
fi

# staleThreshold variable should not exist
if grep -q 'staleThreshold' app/api/stripe/webhook/route.ts 2>/dev/null; then
  check "staleThreshold variable removed from webhook route" "fail"
else
  check "staleThreshold variable removed from webhook route" "pass"
fi

echo ""
echo "=== Fix B: Idempotency race condition fixed ==="

# Should use onConflictDoUpdate instead of onConflictDoNothing
if grep -q 'onConflictDoNothing' lib/webhooks/idempotency.ts 2>/dev/null; then
  check "onConflictDoNothing replaced with onConflictDoUpdate" "fail"
else
  check "onConflictDoNothing replaced with onConflictDoUpdate" "pass"
fi

if grep -q 'onConflictDoUpdate' lib/webhooks/idempotency.ts 2>/dev/null; then
  check "onConflictDoUpdate present in idempotency check" "pass"
else
  check "onConflictDoUpdate present in idempotency check" "fail"
fi

# Should use .returning() for atomic insert result
if grep -q '\.returning(' lib/webhooks/idempotency.ts 2>/dev/null; then
  check ".returning() used for atomic insert result" "pass"
else
  check ".returning() used for atomic insert result" "fail"
fi

echo ""
echo "=== Fix C: Usage increment race condition fixed ==="

# Verify all 3 increment functions use FOR UPDATE
FOR_UPDATE_COUNT=$(grep -c 'FOR UPDATE' lib/billing/usage-tracking.ts 2>/dev/null || echo "0")
if [ "$FOR_UPDATE_COUNT" -ge 3 ]; then
  check "All 3 increment functions use SELECT FOR UPDATE" "pass"
else
  check "All 3 increment functions use SELECT FOR UPDATE (found $FOR_UPDATE_COUNT)" "fail"
fi

# Verify db.transaction is used in usage-tracking
TX_COUNT=$(grep -c 'db.transaction' lib/billing/usage-tracking.ts 2>/dev/null || echo "0")
if [ "$TX_COUNT" -ge 3 ]; then
  check "All 3 increment functions use db.transaction" "pass"
else
  check "All 3 increment functions use db.transaction (found $TX_COUNT)" "fail"
fi

echo ""
echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo "  STATUS: SOME CHECKS FAILED"
  exit 1
else
  echo "  STATUS: ALL CHECKS PASSED"
  exit 0
fi
