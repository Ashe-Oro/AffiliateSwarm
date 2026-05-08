#!/bin/bash
# Run this after completing the Stripe checkout to activate the campaign
# and get the affiliate tracking link.
#
# Usage: bash scripts/demo-complete-setup.sh

PROD_URL="https://affiliateswarm.ai"
LANDING_URL="${LANDING_URL:-https://example.com/product}"
ADV_KEY="swarm_live_6Y0xO9lf1sEqX1zqqaGDdIjzJuV-PYeV"
ADV_ID="6bc0d50f-0421-4116-905f-7b8bb087151c"
CAMP_ID="ee8c27b2-afa0-473d-862f-eef6ab90b5f9"
AFF_KEY="swarm_live_L5vW5iLwc7Mh_ZTIaRCs0Tr7hzxg_rsJ"
AFF_ID="ce3efd90-8fd7-4f6f-bb10-b1a20f720d13"

echo "=== Step 1: Activate Campaign ==="
curl -s -X POST "$PROD_URL/api/v1/campaigns/$CAMP_ID/activate" \
  -H "Authorization: Bearer $ADV_KEY" | jq .

echo ""
echo "=== Step 2: Apply Affiliate to Campaign ==="
APP_RESPONSE=$(curl -s -X POST "$PROD_URL/api/v1/campaigns/$CAMP_ID/applications" \
  -H "Authorization: Bearer $AFF_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pitch": "Demo affiliate for e2e testing"}')
echo "$APP_RESPONSE" | jq .

TRACKING_CODE=$(echo "$APP_RESPONSE" | jq -r '.data.trackingCode')

echo ""
echo "============================================"
echo "  DEMO SETUP COMPLETE"
echo "============================================"
echo ""
echo "Tracking Code: $TRACKING_CODE"
echo ""
echo "Test the full flow:"
echo ""
echo "1. Open the campaign landing URL with swarm_ref appended:"
if [[ "$LANDING_URL" == *"?"* ]]; then
  echo "   ${LANDING_URL}&swarm_ref=$TRACKING_CODE"
else
  echo "   ${LANDING_URL}?swarm_ref=$TRACKING_CODE"
fi
echo ""
echo "2. On the landing page, click 'Sign Up' (fires postback to AffiliateSwarm)"
echo ""
echo "3. Check affiliate wallet balance:"
echo "   curl -s $PROD_URL/api/v1/wallets/$AFF_ID -H 'Authorization: Bearer $AFF_KEY' | jq ."
echo ""
echo "4. Check campaign analytics:"
echo "   curl -s $PROD_URL/api/v1/analytics/overview -H 'Authorization: Bearer $ADV_KEY' | jq ."
echo ""
echo "5. Generate login code to view dashboard:"
echo "   curl -s -X POST $PROD_URL/api/v1/auth/login-code -H 'Authorization: Bearer $ADV_KEY' | jq .data.code"
