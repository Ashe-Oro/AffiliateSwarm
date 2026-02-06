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

# ─── Step 2: Agent registers as an affiliate ─────────────────────
bold "Step 2: Agent registers as an affiliate"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{"agentName": "e2e-test-agent", "description": "End-to-end test agent"}')
check "Registration succeeds" "$RESPONSE" '"success":true'

# Extract affiliateId and apiKey
AFFILIATE_ID=$(echo "$RESPONSE" | grep -o '"affiliateId":"[^"]*"' | cut -d'"' -f4)
API_KEY=$(echo "$RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
echo "  Affiliate ID: $AFFILIATE_ID"
echo "  API Key: ${API_KEY:0:12}..."
echo ""

AUTH_HEADER="Authorization: Bearer $API_KEY"

# ─── Step 3: Agent verifies identity via /api/me ─────────────────
bold "Step 3: Agent verifies identity via /api/me"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "/api/me succeeds" "$RESPONSE" '"success":true'
check "/api/me returns agent name" "$RESPONSE" "e2e-test-agent"
echo ""

# ─── Step 4: Verify auth is enforced (no token → 401) ────────────
bold "Step 4: Verify auth is enforced (no Bearer token → 401)"
RESPONSE=$(curl -s "$BASE_URL/api/me")
check "Missing auth returns error" "$RESPONSE" '"error":"Missing Authorization header"'
echo ""

# ─── Step 5: Verify invalid API key is rejected ──────────────────
bold "Step 5: Verify invalid API key is rejected"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "Authorization: Bearer vnice_bogus_key")
check "Invalid key returns error" "$RESPONSE" '"error":"Invalid API key"'
echo ""

# ─── Step 6: Agent fetches HEARTBEAT.md ──────────────────────────
bold "Step 6: Agent fetches HEARTBEAT.md (heartbeat)"
RESPONSE=$(curl -s "$BASE_URL/HEARTBEAT.md")
check "Heartbeat contains title" "$RESPONSE" "Venice Affiliate Heartbeat"
echo ""

# ─── Step 7: Agent logs a simulated post with referral link ──────
bold "Step 7: Agent logs a simulated post with referral link"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/activity" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "{\"type\": \"post\", \"platform\": \"twitter\", \"content\": \"Privacy in AI matters. Check out Venice.AI — no data retention, uncensored models. https://venice.ai/?ref=$AFFILIATE_ID\"}")
check "Activity logged" "$RESPONSE" '"success":true'
echo ""

# ─── Step 8: A user clicks the referral link (public, no auth) ───
bold "Step 8: A user clicks the referral link"
RESPONSE=$(curl -s "$BASE_URL/api/referral/$AFFILIATE_ID")
check "Referral click tracked" "$RESPONSE" '"success":true'

REFERRAL_ID=$(echo "$RESPONSE" | grep -o '"referralId":[0-9]*' | cut -d':' -f2)
echo "  Referral ID: $REFERRAL_ID"
echo ""

# ─── Step 9: Referred user signs up on Venice ────────────────────
bold "Step 9: Referred user signs up on Venice"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/venice/signup" \
  -H "Content-Type: application/json" \
  -d "{\"referralCode\": \"$AFFILIATE_ID\", \"userName\": \"new-venice-user\"}")
check "Signup succeeds" "$RESPONSE" '"success":true'

USER_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
echo "  User ID: $USER_ID"
echo ""

# ─── Step 10: Referred user buys API credits ($50) ────────────────
bold "Step 10: Referred user purchases \$50 API credits"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/venice/purchase" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"amountUsd\": 50}")
check "Purchase succeeds" "$RESPONSE" '"success":true'
check "Commission is \$10 (20% of \$50)" "$RESPONSE" '"commissionUsd":10'
echo ""

# ─── Step 11: Agent checks earnings via /api/me ──────────────────
bold "Step 11: Agent checks earnings via /api/me (should show \$10)"
RESPONSE=$(curl -s "$BASE_URL/api/me" -H "$AUTH_HEADER")
check "/api/me shows \$10 earned" "$RESPONSE" '"totalEarnedUsd":10'
echo ""

# ─── Step 12: Agent checks earnings via dedicated endpoint ───────
bold "Step 12: Agent checks earnings via /api/earnings"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/$AFFILIATE_ID" -H "$AUTH_HEADER")
check "Earnings endpoint succeeds" "$RESPONSE" '"success":true'
check "Earnings shows \$10 total" "$RESPONSE" '"totalEarnedUsd":10'
check "Earnings shows \$10 available" "$RESPONSE" '"availableUsd":10'
echo ""

# ─── Step 13: Verify another agent can't see our earnings ────────
bold "Step 13: Verify earnings are protected (wrong affiliateId → 403)"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/aff_someone_else" -H "$AUTH_HEADER")
check "Wrong affiliateId returns 403" "$RESPONSE" '"error":"You can only view your own earnings"'
echo ""

# ─── Step 14: Agent checks referral funnel (authenticated) ───────
bold "Step 14: Agent checks referral funnel"
RESPONSE=$(curl -s "$BASE_URL/api/referrals/$AFFILIATE_ID/funnel" -H "$AUTH_HEADER")
check "Funnel shows 1 conversion" "$RESPONSE" '"conversions":1'
echo ""

# ─── Step 15: Agent requests payout (authenticated) ──────────────
bold "Step 15: Agent requests payout of \$10"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/earnings/$AFFILIATE_ID/payout" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"amountUsd": 10.00, "walletAddress": "0xTestWallet123"}')
check "Payout request succeeds" "$RESPONSE" '"success":true'
echo ""

# ─── Step 16: Agent checks full stats (authenticated) ────────────
bold "Step 16: Agent checks full stats (activity + earnings + funnel)"
RESPONSE=$(curl -s "$BASE_URL/api/stats/$AFFILIATE_ID" -H "$AUTH_HEADER")
check "Stats show 1 post" "$RESPONSE" '"totalPosts":1'
check "Stats show \$10 earned" "$RESPONSE" '"totalEarnedUsd":10'
check "Stats show 1 conversion" "$RESPONSE" '"conversions":1'
echo ""

# ─── Step 17: Agent checks payout history ─────────────────────────
bold "Step 17: Agent checks payout history"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/$AFFILIATE_ID/payouts" -H "$AUTH_HEADER")
check "Payout history succeeds" "$RESPONSE" '"success":true'
check "Payout history shows wallet" "$RESPONSE" '0xTestWallet123'
echo ""

# ─── Step 18: Health check ────────────────────────────────────────
bold "Step 18: Health check"
RESPONSE=$(curl -s "$BASE_URL/health")
check "Health endpoint returns ok" "$RESPONSE" '"status":"ok"'
echo ""

# ─── Step 19: Root endpoint ───────────────────────────────────────
bold "Step 19: Root endpoint shows platform info"
RESPONSE=$(curl -s "$BASE_URL/")
check "Root shows platform name" "$RESPONSE" "Regata"
check "Root shows auth requirement" "$RESPONSE" "Bearer token"
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
