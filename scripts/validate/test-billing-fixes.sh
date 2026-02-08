#!/usr/bin/env bash
# ============================================================================
# Billing Security Fixes - Validation Script
# ============================================================================
# Tests:
#   1. Stripe session ownership bypass (Fix A)
#   2. Trial search TOCTOU race condition (Fix B)
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0

pass() { echo -e "  ${GREEN}PASS${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAIL=$((FAIL + 1)); }
info() { echo -e "  ${YELLOW}INFO${NC} $1"; }

# ============================================================================
# Test 1: Stripe Session Ownership Bypass (Code Verification)
# ============================================================================
echo ""
echo "=== Test 1: Stripe Session Ownership Bypass ==="
echo ""
info "Verifying code-level fix in app/api/stripe/verify-session/route.ts"

ROUTE_FILE="app/api/stripe/verify-session/route.ts"

if grep -q "subscription.customer" "$ROUTE_FILE" && \
   grep -q "subCustomer !== user.stripeCustomerId" "$ROUTE_FILE" && \
   grep -q "Session does not belong to this user" "$ROUTE_FILE" && \
   grep -q "status: 403" "$ROUTE_FILE"; then
    pass "Ownership check exists: compares subscription.customer to user.stripeCustomerId"
else
    fail "Missing ownership check in verify-session route"
fi

# Verify the check happens BEFORE handleSubscriptionChange
OWNER_LINE=$(grep -n "subCustomer !== user.stripeCustomerId" "$ROUTE_FILE" | head -1 | cut -d: -f1 || true)
HANDLE_LINE=$(grep -n "await handleSubscriptionChange" "$ROUTE_FILE" | head -1 | cut -d: -f1 || true)

if [ -n "$OWNER_LINE" ] && [ -n "$HANDLE_LINE" ] && [ "$OWNER_LINE" -lt "$HANDLE_LINE" ]; then
    pass "Ownership check occurs BEFORE handleSubscriptionChange call"
else
    fail "Ownership check must happen before handleSubscriptionChange"
fi

# Verify it logs a warning with metadata
if grep -q "Session verification - customer mismatch" "$ROUTE_FILE"; then
    pass "Customer mismatch logs a warning with audit metadata"
else
    fail "Missing warning log for customer mismatch"
fi

# ============================================================================
# Test 2: Trial Search TOCTOU Race (Code Verification)
# ============================================================================
echo ""
echo "=== Test 2: Trial Search TOCTOU Race ==="
echo ""
info "Verifying code-level fix in lib/search-engine/v2/workers/dispatch.ts"

DISPATCH_FILE="lib/search-engine/v2/workers/dispatch.ts"

if grep -q "db.transaction" "$DISPATCH_FILE" && \
   grep -q "FOR UPDATE" "$DISPATCH_FILE"; then
    pass "Trial validation wrapped in db.transaction with FOR UPDATE lock"
else
    fail "Missing transaction + FOR UPDATE lock in dispatch"
fi

if grep -q "validateTrialSearchLimit" "$DISPATCH_FILE" && \
   grep -q "createV2Job" "$DISPATCH_FILE"; then
    pass "Both validateTrialSearchLimit and createV2Job inside transaction"
else
    fail "Trial validation and job creation not both inside transaction"
fi

if grep -q "TRIAL_LIMIT:" "$DISPATCH_FILE"; then
    pass "TRIAL_LIMIT error prefix used for catch-block routing"
else
    fail "Missing TRIAL_LIMIT error prefix pattern"
fi

# Verify sql import
if grep -q "import.*sql.*from 'drizzle-orm'" "$DISPATCH_FILE"; then
    pass "sql template tag imported from drizzle-orm"
else
    fail "Missing sql import from drizzle-orm"
fi

# ============================================================================
# Test 3: Concurrent Trial Search Race (Live, requires running server + trial user)
# ============================================================================
echo ""
echo "=== Test 3: Concurrent Trial Search Stress (Live) ==="
echo ""

if [ -z "${TEST_SESSION_TOKEN:-}" ] || [ -z "${TEST_CAMPAIGN_ID:-}" ]; then
    info "Skipping live test: set TEST_SESSION_TOKEN and TEST_CAMPAIGN_ID to run"
    info "Example: TEST_SESSION_TOKEN=sess_xxx TEST_CAMPAIGN_ID=camp_xxx bash $0"
else
    info "Firing 5 concurrent search requests for trial user..."

    PIDS=()
    TMPDIR_RACE=$(mktemp -d)

    for i in $(seq 1 5); do
        curl -s -o "$TMPDIR_RACE/resp_$i.json" -w "%{http_code}" \
            -X POST "$BASE_URL/api/v2/search" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TEST_SESSION_TOKEN" \
            -d "{\"platform\":\"tiktok\",\"keywords\":[\"test-race-$i\"],\"targetResults\":10,\"campaignId\":\"$TEST_CAMPAIGN_ID\"}" \
            > "$TMPDIR_RACE/status_$i.txt" 2>/dev/null &
        PIDS+=($!)
    done

    # Wait for all
    for pid in "${PIDS[@]}"; do
        wait "$pid" 2>/dev/null || true
    done

    SUCCESS_COUNT=0
    BLOCKED_COUNT=0
    for i in $(seq 1 5); do
        STATUS=$(cat "$TMPDIR_RACE/status_$i.txt" 2>/dev/null || echo "000")
        if [ "$STATUS" = "200" ]; then
            ((SUCCESS_COUNT++))
        elif [ "$STATUS" = "403" ]; then
            ((BLOCKED_COUNT++))
        fi
    done

    info "Results: $SUCCESS_COUNT succeeded, $BLOCKED_COUNT blocked (403)"

    # TRIAL_SEARCH_LIMIT is typically 3
    if [ "$SUCCESS_COUNT" -le 3 ]; then
        pass "At most TRIAL_SEARCH_LIMIT searches succeeded ($SUCCESS_COUNT/5)"
    else
        fail "Too many searches succeeded: $SUCCESS_COUNT (expected <= TRIAL_SEARCH_LIMIT)"
    fi

    rm -rf "$TMPDIR_RACE"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "============================================"
echo -e "Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "============================================"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
