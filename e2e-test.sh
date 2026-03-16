#!/bin/bash
# End-to-end test for Regatta — Venice Agent Affiliate Platform
# Exercises the complete flow: discover → register → authenticate → operate → refer → earn → payout

BASE_URL="${PLATFORM_URL:-http://192.168.4.89:3000}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
ADMIN_SESSION_TOKEN=""

# Obtain an admin session token via POST /api/admin/login
admin_login() {
  if [ -z "$ADMIN_SECRET" ]; then
    return
  fi
  local response
  response=$(curl -s -X POST "$BASE_URL/api/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"password\": \"$ADMIN_SECRET\"}")
  ADMIN_SESSION_TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
}

admin_auth_header() {
  echo "Authorization: Bearer $ADMIN_SESSION_TOKEN"
}
PASS=0
FAIL=0

green() { echo -e "\033[32m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }
bold() { echo -e "\033[1m$1\033[0m"; }

check() {
  local label="$1"
  local response="$2"
  local expected="$3"
  if echo "$response" | grep -q "$expected"; then
    green "  ✓ $label"
    PASS=$((PASS + 1))
  else
    red "  ✗ $label — expected to find: $expected"
    echo "  Response: $response"
    FAIL=$((FAIL + 1))
  fi
}

check_not() {
  local label="$1"
  local response="$2"
  local unexpected="$3"
  if echo "$response" | grep -q "$unexpected"; then
    red "  ✗ $label — did NOT expect to find: $unexpected"
    echo "  Response: $response"
    FAIL=$((FAIL + 1))
  else
    green "  ✓ $label"
    PASS=$((PASS + 1))
  fi
}

echo ""
bold "═══════════════════════════════════════════════════════════"
bold "  Regatta — Venice Agent Affiliate Platform — E2E Test"
bold "  Target: $BASE_URL"
bold "═══════════════════════════════════════════════════════════"
echo ""

# ─── Step 1: Health check ──────────────────────────────────────
bold "Step 1: Health check"
RESPONSE=$(curl -s "$BASE_URL/health")
check "Health endpoint returns ok" "$RESPONSE" '"status":"ok"'
echo ""

# ─── Step 2: Agent discovers the skill file ────────────────────
bold "Step 2: Agent discovers SKILL.md"
RESPONSE=$(curl -s "$BASE_URL/SKILL.md")
check "SKILL.md contains registration title" "$RESPONSE" "Register as a Venice.AI Affiliate Agent"
check "SKILL.md has resolved platform URL (no raw templates)" "$RESPONSE" "$BASE_URL"
check_not "SKILL.md has no unresolved templates" "$RESPONSE" "{{PLATFORM_URL}}"
echo ""

# ─── Step 3: Agent discovers AFFILIATE.md ───────────────
bold "Step 3: Agent discovers AFFILIATE.md"
RESPONSE=$(curl -s "$BASE_URL/AFFILIATE.md")
check "Venice affiliate file contains title" "$RESPONSE" "Venice Affiliate Playbook"
check "Venice affiliate has resolved platform URL" "$RESPONSE" "$BASE_URL"
check_not "Venice affiliate has no unresolved templates" "$RESPONSE" "{{PLATFORM_URL}}"
echo ""

# ─── Step 4: Root endpoint ─────────────────────────────────────
bold "Step 4: Root endpoint shows platform info"
RESPONSE=$(curl -s "$BASE_URL/")
check "Root shows platform name" "$RESPONSE" "Regatta"
check "Root shows auth requirement" "$RESPONSE" "Bearer YOUR_API_KEY"
echo ""

# ─── Step 5: Agent registers as an affiliate (pending) ─────────
bold "Step 5: Agent registers as an affiliate (status: pending)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{"agentName": "e2e-test-agent", "description": "End-to-end test agent"}')
check "Registration succeeds" "$RESPONSE" '"success":true'
check "Registration returns pending status" "$RESPONSE" '"status":"pending"'

AFFILIATE_ID=$(echo "$RESPONSE" | grep -o '"affiliateId":"[^"]*"' | cut -d'"' -f4)
API_KEY=$(echo "$RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
echo "  Affiliate ID: $AFFILIATE_ID"
echo "  API Key: ${API_KEY:0:12}..."
echo ""

AUTH_HEADER="Authorization: Bearer $API_KEY"

# ─── Step 6: Pending agent cannot access authenticated endpoints
bold "Step 6: Pending agent gets 403 on authenticated endpoints"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "Pending agent gets 403" "$RESPONSE" '"error":"Account pending approval"'
echo ""

# ─── Step 7: Human approves the agent ──────────────────────────
bold "Step 7: Human approves the agent via admin dashboard endpoint"
admin_login
RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/approve/$AFFILIATE_ID" \
  -H "$(admin_auth_header)")
check "Admin approval succeeds" "$RESPONSE" '"success":true'
echo ""

# ─── Step 8: Agent verifies identity via /api/me ───────────────
bold "Step 8: Approved agent verifies identity via /api/me"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "/api/me succeeds" "$RESPONSE" '"success":true'
check "/api/me returns agent name" "$RESPONSE" "e2e-test-agent"
check "/api/me shows active status" "$RESPONSE" '"status":"active"'
echo ""

# ─── Step 9: Verify auth enforcement ───────────────────────────
bold "Step 9: Verify auth is enforced"
RESPONSE=$(curl -s "$BASE_URL/api/me")
check "Missing auth returns 401" "$RESPONSE" '"error":"Missing Authorization header"'
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "Authorization: Bearer vnice_bogus_key")
check "Invalid key returns 401" "$RESPONSE" '"error":"Invalid API key"'
echo ""

# ─── Step 10: Agent logs generic activity (disabled) ───────────────────────
bold "Step 10: Agent logs generic activity"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/activity" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"type": "search", "platform": "other", "content": "privacy-first ai inference providers"}')
check "Activity tracking disabled response" "$RESPONSE" '"error":"Activity tracking is disabled"'
echo ""

# ─── Step 11: A user clicks the referral link ──────────────────
bold "Step 11: A user clicks the referral link"
RESPONSE=$(curl -s "$BASE_URL/api/referral/$AFFILIATE_ID")
check "Referral click tracked" "$RESPONSE" '"success":true'
REFERRAL_ID=$(echo "$RESPONSE" | grep -o '"referralId":[0-9]*' | cut -d':' -f2)
echo "  Referral ID: $REFERRAL_ID"
echo ""

# ─── Step 12: Referred user signs up on Venice ─────────────────
bold "Step 12: Referred user signs up on Venice"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/venice/signup" \
  -H "Content-Type: application/json" \
  -d "{\"referralCode\": \"$AFFILIATE_ID\", \"userName\": \"e2e-venice-user\"}")
check "Signup succeeds" "$RESPONSE" '"success":true'
USER_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
echo "  User ID: $USER_ID"
echo ""

# ─── Step 13: Referred user buys API credits ($50) ─────────────
bold "Step 13: Referred user purchases \$50 API credits"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/venice/purchase" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"amountUsd\": 50}")
check "Purchase succeeds" "$RESPONSE" '"success":true'
check "Commission is \$10 (20% of \$50)" "$RESPONSE" '"commissionUsd":10'
echo ""

# ─── Step 14: Agent checks earnings ────────────────────────────
bold "Step 14: Agent checks earnings (\$10 available)"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/$AFFILIATE_ID" -H "$AUTH_HEADER")
check "Earnings endpoint succeeds" "$RESPONSE" '"success":true'
check "Earnings shows \$10 total" "$RESPONSE" '"totalEarnedUsd":10'
check "Earnings shows \$10 available" "$RESPONSE" '"availableUsd":10'
check "Earnings shows \$0 paid out" "$RESPONSE" '"paidOutUsd":0'
echo ""

# ─── Step 15: Verify earnings are protected ─────────────────────
bold "Step 15: Verify earnings are protected (wrong affiliateId)"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/aff_someone_else" -H "$AUTH_HEADER")
check "Wrong affiliateId returns 403" "$RESPONSE" '"error":"You can only view your own earnings"'
echo ""

# ─── Step 16: Agent checks referral funnel ──────────────────────
bold "Step 16: Agent checks referral funnel"
RESPONSE=$(curl -s "$BASE_URL/api/referrals/$AFFILIATE_ID/funnel" -H "$AUTH_HEADER")
check "Funnel shows 1 click" "$RESPONSE" '"clicks":1'
check "Funnel shows 1 signup" "$RESPONSE" '"signups":1'
check "Funnel shows 1 conversion" "$RESPONSE" '"conversions":1'
echo ""

# ─── Step 17: Agent requests payout ─────────────────────────────
bold "Step 17: Agent requests payout of \$10"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/earnings/$AFFILIATE_ID/payout" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"amountUsd": 10.00, "walletAddress": "0xTestWallet123"}')
check "Payout succeeds" "$RESPONSE" '"success":true'
check "Payout status is completed" "$RESPONSE" '"status":"completed"'
echo ""

# ─── Step 18: Verify balance updated after payout ───────────────
bold "Step 18: Verify balance updated after payout"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/$AFFILIATE_ID" -H "$AUTH_HEADER")
check "Available balance is now \$0" "$RESPONSE" '"availableUsd":0'
check "Paid out is now \$10" "$RESPONSE" '"paidOutUsd":10'
echo ""

# ─── Step 19: Duplicate payout fails ───────────────────────────
bold "Step 19: Duplicate payout fails (insufficient balance)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/earnings/$AFFILIATE_ID/payout" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"amountUsd": 10.00, "walletAddress": "0xTestWallet123"}')
check "Duplicate payout rejected" "$RESPONSE" '"success":false'
check "Error mentions insufficient balance" "$RESPONSE" "Insufficient balance"
echo ""

# ─── Step 20: Agent checks payout history ──────────────────────
bold "Step 20: Agent checks payout history"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/$AFFILIATE_ID/payouts" -H "$AUTH_HEADER")
check "Payout history succeeds" "$RESPONSE" '"success":true'
check "Payout history shows wallet" "$RESPONSE" '0xTestWallet123'
check "Payout shows completed status" "$RESPONSE" '"status":"completed"'
echo ""

# ─── Step 21: Admin dashboard endpoint returns enriched data ────
bold "Step 21: Admin dashboard endpoint returns enriched data"
RESPONSE=$(curl -s "$BASE_URL/api/affiliates" -H "$(admin_auth_header)")
check "Affiliates endpoint returns stats" "$RESPONSE" '"stats":'
check "Affiliates endpoint returns funnel" "$RESPONSE" '"funnel":'
check "Affiliates endpoint returns earnings" "$RESPONSE" '"earnings":'
check "Affiliates endpoint returns platform totals" "$RESPONSE" '"platform":'
echo ""

# ─── Step 22: Agent opts out (DELETE /api/me) ──────────────────
bold "Step 22: Agent opts out (DELETE /api/me)"
RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "Account deletion succeeds" "$RESPONSE" '"success":true'
check "Deletion confirms affiliate ID" "$RESPONSE" "$AFFILIATE_ID"
check "Deletion reports activity logs deleted" "$RESPONSE" '"activityLogs":'
echo ""

# ─── Step 23: Verify agent can no longer authenticate ──────────
bold "Step 23: Verify deleted agent can no longer authenticate"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "Deleted agent gets 401" "$RESPONSE" '"error":"Invalid API key"'
echo ""

# ─── Summary ───────────────────────────────────────────────────
bold "═══════════════════════════════════════════════════════════"
echo ""
if [ $FAIL -eq 0 ]; then
  green "  ALL $PASS TESTS PASSED"
else
  red "  $FAIL FAILED, $PASS PASSED"
fi
echo ""
bold "═══════════════════════════════════════════════════════════"
echo ""
