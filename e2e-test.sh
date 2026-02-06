#!/bin/bash
# End-to-end test for Regata — Venice Agent Affiliate Platform
# Exercises the complete MRD flow: discover → register → authenticate → operate → refer → earn → payout

BASE_URL="http://192.168.4.89:3000"
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

echo ""
bold "═══════════════════════════════════════════════════════════"
bold "  Regata — Venice Agent Affiliate Platform — E2E Test"
bold "═══════════════════════════════════════════════════════════"
echo ""

# ─── Step 1: Agent discovers the skill file ──────────────────────
bold "Step 1: Agent discovers SKILL.md"
RESPONSE=$(curl -s "$BASE_URL/SKILL.md")
check "SKILL.md contains program name" "$RESPONSE" "Venice.AI Agent Affiliate Program"
echo ""

# ─── Step 2: Agent registers as an affiliate (pending) ───────────
bold "Step 2: Agent registers as an affiliate (status: pending)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{"agentName": "e2e-test-agent", "description": "End-to-end test agent"}')
check "Registration succeeds" "$RESPONSE" '"success":true'
check "Registration returns pending status" "$RESPONSE" '"status":"pending"'
check "Registration returns approval URL" "$RESPONSE" '"approvalUrl":'

# Extract affiliateId, apiKey, and approval token
AFFILIATE_ID=$(echo "$RESPONSE" | grep -o '"affiliateId":"[^"]*"' | cut -d'"' -f4)
API_KEY=$(echo "$RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
APPROVAL_URL=$(echo "$RESPONSE" | grep -o '"approvalUrl":"[^"]*"' | cut -d'"' -f4)
APPROVAL_TOKEN=$(echo "$APPROVAL_URL" | grep -o 'approve_[^"]*')
echo "  Affiliate ID: $AFFILIATE_ID"
echo "  API Key: ${API_KEY:0:12}..."
echo "  Approval Token: ${APPROVAL_TOKEN:0:20}..."
echo ""

AUTH_HEADER="Authorization: Bearer $API_KEY"

# ─── Step 3: Pending agent cannot access authenticated endpoints ──
bold "Step 3: Pending agent gets 403 on authenticated endpoints"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "Pending agent gets 403" "$RESPONSE" '"error":"Account pending approval"'
echo ""

# ─── Step 4: Human approves the agent ─────────────────────────────
bold "Step 4: Human approves the agent via approval URL"
RESPONSE=$(curl -s "$BASE_URL/api/approve/$APPROVAL_TOKEN")
check "Approval page shows success" "$RESPONSE" "Agent Approved"
check "Approval page shows agent name" "$RESPONSE" "e2e-test-agent"
echo ""

# ─── Step 5: Agent verifies identity via /api/me ─────────────────
bold "Step 5: Approved agent verifies identity via /api/me"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "/api/me succeeds" "$RESPONSE" '"success":true'
check "/api/me returns agent name" "$RESPONSE" "e2e-test-agent"
check "/api/me shows active status" "$RESPONSE" '"status":"active"'
echo ""

# ─── Step 6: Verify auth is enforced (no token → 401) ────────────
bold "Step 6: Verify auth is enforced (no Bearer token → 401)"
RESPONSE=$(curl -s "$BASE_URL/api/me")
check "Missing auth returns error" "$RESPONSE" '"error":"Missing Authorization header"'
echo ""

# ─── Step 7: Verify invalid API key is rejected ──────────────────
bold "Step 7: Verify invalid API key is rejected"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "Authorization: Bearer vnice_bogus_key")
check "Invalid key returns error" "$RESPONSE" '"error":"Invalid API key"'
echo ""

# ─── Step 8: Agent fetches HEARTBEAT.md ──────────────────────────
bold "Step 8: Agent fetches HEARTBEAT.md (heartbeat)"
RESPONSE=$(curl -s "$BASE_URL/HEARTBEAT.md")
check "Heartbeat contains title" "$RESPONSE" "Venice Affiliate Heartbeat"
echo ""

# ─── Step 9: Agent logs a simulated post with referral link ──────
bold "Step 9: Agent logs a simulated post with referral link"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/activity" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "{\"type\": \"post\", \"platform\": \"twitter\", \"content\": \"Privacy in AI matters. Check out Venice.AI — no data retention, uncensored models. https://venice.ai/?ref=$AFFILIATE_ID\"}")
check "Activity logged" "$RESPONSE" '"success":true'
echo ""

# ─── Step 10: A user clicks the referral link (public, no auth) ──
bold "Step 10: A user clicks the referral link"
RESPONSE=$(curl -s "$BASE_URL/api/referral/$AFFILIATE_ID")
check "Referral click tracked" "$RESPONSE" '"success":true'

REFERRAL_ID=$(echo "$RESPONSE" | grep -o '"referralId":[0-9]*' | cut -d':' -f2)
echo "  Referral ID: $REFERRAL_ID"
echo ""

# ─── Step 11: Referred user signs up on Venice ───────────────────
bold "Step 11: Referred user signs up on Venice"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/venice/signup" \
  -H "Content-Type: application/json" \
  -d "{\"referralCode\": \"$AFFILIATE_ID\", \"userName\": \"new-venice-user\"}")
check "Signup succeeds" "$RESPONSE" '"success":true'

USER_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
echo "  User ID: $USER_ID"
echo ""

# ─── Step 12: Referred user buys API credits ($50) ───────────────
bold "Step 12: Referred user purchases \$50 API credits"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/venice/purchase" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"amountUsd\": 50}")
check "Purchase succeeds" "$RESPONSE" '"success":true'
check "Commission is \$10 (20% of \$50)" "$RESPONSE" '"commissionUsd":10'
echo ""

# ─── Step 13: Agent checks earnings via /api/me ──────────────────
bold "Step 13: Agent checks earnings via /api/me (should show \$10)"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "/api/me shows \$10 earned" "$RESPONSE" '"totalEarnedUsd":10'
echo ""

# ─── Step 14: Agent checks earnings via dedicated endpoint ───────
bold "Step 14: Agent checks earnings via /api/earnings"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/$AFFILIATE_ID" -H "$AUTH_HEADER")
check "Earnings endpoint succeeds" "$RESPONSE" '"success":true'
check "Earnings shows \$10 total" "$RESPONSE" '"totalEarnedUsd":10'
check "Earnings shows \$10 available" "$RESPONSE" '"availableUsd":10'
echo ""

# ─── Step 15: Verify another agent can't see our earnings ────────
bold "Step 15: Verify earnings are protected (wrong affiliateId → 403)"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/aff_someone_else" -H "$AUTH_HEADER")
check "Wrong affiliateId returns 403" "$RESPONSE" '"error":"You can only view your own earnings"'
echo ""

# ─── Step 16: Agent checks referral funnel (authenticated) ───────
bold "Step 16: Agent checks referral funnel"
RESPONSE=$(curl -s "$BASE_URL/api/referrals/$AFFILIATE_ID/funnel" -H "$AUTH_HEADER")
check "Funnel shows 1 conversion" "$RESPONSE" '"conversions":1'
echo ""

# ─── Step 17: Agent requests payout (authenticated) ──────────────
bold "Step 17: Agent requests payout of \$10"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/earnings/$AFFILIATE_ID/payout" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"amountUsd": 10.00, "walletAddress": "0xTestWallet123"}')
check "Payout request succeeds" "$RESPONSE" '"success":true'
echo ""

# ─── Step 18: Agent checks full stats (authenticated) ────────────
bold "Step 18: Agent checks full stats (activity + earnings + funnel)"
RESPONSE=$(curl -s "$BASE_URL/api/stats/$AFFILIATE_ID" -H "$AUTH_HEADER")
check "Stats show 1 post" "$RESPONSE" '"totalPosts":1'
check "Stats show \$10 earned" "$RESPONSE" '"totalEarnedUsd":10'
check "Stats show 1 conversion" "$RESPONSE" '"conversions":1'
echo ""

# ─── Step 19: Agent checks payout history ────────────────────────
bold "Step 19: Agent checks payout history"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/$AFFILIATE_ID/payouts" -H "$AUTH_HEADER")
check "Payout history succeeds" "$RESPONSE" '"success":true'
check "Payout history shows wallet" "$RESPONSE" '0xTestWallet123'
echo ""

# ─── Step 20: Health check ───────────────────────────────────────
bold "Step 20: Health check"
RESPONSE=$(curl -s "$BASE_URL/health")
check "Health endpoint returns ok" "$RESPONSE" '"status":"ok"'
echo ""

# ─── Step 21: Root endpoint ──────────────────────────────────────
bold "Step 21: Root endpoint shows platform info"
RESPONSE=$(curl -s "$BASE_URL/")
check "Root shows platform name" "$RESPONSE" "Regata"
check "Root shows auth requirement" "$RESPONSE" "Bearer YOUR_API_KEY"
echo ""

# ─── Step 22: Agent opts out (DELETE /api/me) ────────────────────
bold "Step 22: Agent opts out (DELETE /api/me)"
RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "Account deletion succeeds" "$RESPONSE" '"success":true'
check "Deletion confirms affiliate ID" "$RESPONSE" "$AFFILIATE_ID"
check "Deletion reports activity logs deleted" "$RESPONSE" '"activityLogs":'
echo ""

# ─── Step 23: Verify agent can no longer authenticate ────────────
bold "Step 23: Verify deleted agent can no longer authenticate"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "Deleted agent gets 401" "$RESPONSE" '"error":"Invalid API key"'
echo ""

# ─── Summary ─────────────────────────────────────────────────────
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
