#!/bin/bash
# End-to-end test for Venice Agent Affiliate Platform
# Exercises the complete MRD flow: discover → register → operate → refer → earn → payout

BASE_URL="http://localhost:3000"
PASS=0
FAIL=0

green() { echo -e "\033[32m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }
bold() { echo -e "\033[1m$1\033[0m"; }

check() {
  if echo "$1" | grep -q "$2"; then
    green "  ✓ PASS"
    PASS=$((PASS + 1))
  else
    red "  ✗ FAIL — expected to find: $2"
    echo "  Response: $1"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
bold "═══════════════════════════════════════════════════════════"
bold "  Venice Agent Affiliate Platform — End-to-End Test"
bold "═══════════════════════════════════════════════════════════"
echo ""

# ─── Step 1: Agent discovers the skill file ──────────────────────
bold "Step 1: Agent discovers SKILL.md"
RESPONSE=$(curl -s "$BASE_URL/SKILL.md")
check "$RESPONSE" "Venice.AI Agent Affiliate Program"
echo ""

# ─── Step 2: Agent registers as an affiliate ─────────────────────
bold "Step 2: Agent registers as an affiliate"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{"agentName": "e2e-test-agent", "description": "End-to-end test agent"}')
check "$RESPONSE" '"success":true'

# Extract affiliateId
AFFILIATE_ID=$(echo "$RESPONSE" | grep -o '"affiliateId":"[^"]*"' | cut -d'"' -f4)
echo "  Affiliate ID: $AFFILIATE_ID"
echo ""

# ─── Step 3: Agent fetches HEARTBEAT.md (the recurring action loop) ──
bold "Step 3: Agent fetches HEARTBEAT.md (heartbeat)"
RESPONSE=$(curl -s "$BASE_URL/HEARTBEAT.md")
check "$RESPONSE" "Venice Affiliate Heartbeat"
echo ""

# ─── Step 4: Agent logs a simulated post with referral link ─────
bold "Step 4: Agent logs a simulated post with referral link"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/activity" \
  -H "Content-Type: application/json" \
  -d "{\"affiliateId\": \"$AFFILIATE_ID\", \"type\": \"post\", \"platform\": \"twitter\", \"content\": \"Privacy in AI matters. Check out Venice.AI — no data retention, uncensored models. https://venice.ai/?ref=$AFFILIATE_ID\"}")
check "$RESPONSE" '"success":true'
echo ""

# ─── Step 5: A user clicks the referral link ────────────────────
bold "Step 5: A user clicks the referral link"
RESPONSE=$(curl -s "$BASE_URL/api/referral/$AFFILIATE_ID")
check "$RESPONSE" '"success":true'

REFERRAL_ID=$(echo "$RESPONSE" | grep -o '"referralId":[0-9]*' | cut -d':' -f2)
echo "  Referral ID: $REFERRAL_ID"
echo ""

# ─── Step 6: Referred user signs up on Venice ───────────────────
bold "Step 6: Referred user signs up on Venice"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/venice/signup" \
  -H "Content-Type: application/json" \
  -d "{\"referralCode\": \"$AFFILIATE_ID\", \"userName\": \"new-venice-user\"}")
check "$RESPONSE" '"success":true'

USER_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
echo "  User ID: $USER_ID"
echo ""

# ─── Step 7: Referred user buys API credits ($50) ───────────────
bold "Step 7: Referred user purchases \$50 API credits"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/venice/purchase" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"amountUsd\": 50}")
check "$RESPONSE" '"commissionUsd":10'
echo ""

# ─── Step 8: Agent checks earnings ──────────────────────────────
bold "Step 8: Agent checks earnings (should show \$10)"
RESPONSE=$(curl -s "$BASE_URL/api/earnings/$AFFILIATE_ID")
check "$RESPONSE" '"totalEarnedUsd":10'
echo ""

# ─── Step 9: Agent checks referral funnel ────────────────────────
bold "Step 9: Agent checks referral funnel"
RESPONSE=$(curl -s "$BASE_URL/api/referrals/$AFFILIATE_ID/funnel")
check "$RESPONSE" '"conversions":1'
echo ""

# ─── Step 10: Agent requests payout ─────────────────────────────
bold "Step 10: Agent requests payout of \$10"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/earnings/$AFFILIATE_ID/payout" \
  -H "Content-Type: application/json" \
  -d '{"amountUsd": 10.00, "walletAddress": "0xTestWallet123"}')
check "$RESPONSE" '"success":true'
echo ""

# ─── Step 11: Agent checks full stats ───────────────────────────
bold "Step 11: Agent checks full stats (activity + earnings + funnel)"
RESPONSE=$(curl -s "$BASE_URL/api/stats/$AFFILIATE_ID")
check "$RESPONSE" '"totalPosts":1'
check "$RESPONSE" '"totalEarnedUsd":10'
check "$RESPONSE" '"conversions":1'
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
