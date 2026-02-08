#!/usr/bin/env bash
# test-auth-fixes.sh — Validate IDOR fixes for Jobs and V2 Status endpoints
#
# Prerequisites:
#   - Dev server running on localhost:3000
#   - DEV_AUTH_BYPASS=true in .env.local (enables x-dev-auth header)
#   - At least one job exists in the database
#
# Usage: bash scripts/validate/test-auth-fixes.sh [JOB_ID]

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
OWNER_USER="user_owner_test_123"
WRONG_USER="user_attacker_test_456"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass=0
fail=0

check_status() {
  local description="$1"
  local expected="$2"
  local actual="$3"

  if [ "$actual" -eq "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} $description (HTTP $actual)"
    ((pass++))
  else
    echo -e "  ${RED}FAIL${NC} $description — expected $expected, got $actual"
    ((fail++))
  fi
}

# ── Resolve a job ID ──────────────────────────────────────────────────────────
JOB_ID="${1:-}"

if [ -z "$JOB_ID" ]; then
  echo -e "${YELLOW}No JOB_ID provided. Attempting to find one via API...${NC}"
  # Try to get a job from /api/jobs using the owner user
  JOBS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "x-dev-auth: dev-bypass" \
    -H "x-dev-user-id: $OWNER_USER" \
    "$BASE_URL/api/jobs" 2>/dev/null || true)

  HTTP_CODE=$(echo "$JOBS_RESPONSE" | tail -1)
  BODY=$(echo "$JOBS_RESPONSE" | sed '$d')

  # Try to extract first job ID from response
  JOB_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)

  if [ -z "$JOB_ID" ]; then
    echo -e "${RED}Could not auto-detect a job ID. Please provide one:${NC}"
    echo "  bash $0 <JOB_ID>"
    exit 1
  fi
  echo -e "Using job: ${JOB_ID}\n"
fi

echo "============================================"
echo " Auth Fix Validation"
echo " Base URL : $BASE_URL"
echo " Job ID   : $JOB_ID"
echo " Owner    : $OWNER_USER"
echo " Attacker : $WRONG_USER"
echo "============================================"
echo ""

# ── Test 1: GET /api/jobs/:id as wrong user → 401 ───────────────────────────
echo "[Test 1] GET /api/jobs/:id as wrong user"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: $WRONG_USER" \
  "$BASE_URL/api/jobs/$JOB_ID")
check_status "Wrong user GET job" 401 "$HTTP"

# ── Test 2: DELETE /api/jobs/:id as wrong user → 401 ─────────────────────────
echo "[Test 2] DELETE /api/jobs/:id as wrong user"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X DELETE \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: $WRONG_USER" \
  "$BASE_URL/api/jobs/$JOB_ID")
check_status "Wrong user DELETE job" 401 "$HTTP"

# ── Test 3: GET /api/jobs/:id as owner → 200 ────────────────────────────────
echo "[Test 3] GET /api/jobs/:id as owner"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: $OWNER_USER" \
  "$BASE_URL/api/jobs/$JOB_ID")
check_status "Owner GET job" 200 "$HTTP"

# ── Test 4: GET /api/v2/status as wrong user → 401 ──────────────────────────
echo "[Test 4] GET /api/v2/status?jobId=X as wrong user"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: $WRONG_USER" \
  "$BASE_URL/api/v2/status?jobId=$JOB_ID")
check_status "Wrong user v2/status" 401 "$HTTP"

# ── Test 5: GET /api/v2/status as owner → 200 ───────────────────────────────
echo "[Test 5] GET /api/v2/status?jobId=X as owner"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: $OWNER_USER" \
  "$BASE_URL/api/v2/status?jobId=$JOB_ID")
check_status "Owner v2/status" 200 "$HTTP"

# ── Test 6: GET /api/jobs/:id with no auth → 401 ────────────────────────────
echo "[Test 6] GET /api/jobs/:id with no auth"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/jobs/$JOB_ID")
check_status "No auth GET job" 401 "$HTTP"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo -e " Results: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}"
echo "============================================"

[ "$fail" -eq 0 ] && exit 0 || exit 1
