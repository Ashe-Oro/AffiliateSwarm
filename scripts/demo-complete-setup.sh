#!/bin/bash
# Run this after funding the wallet to activate the campaign
# and get the affiliate tracking link.
#
# Usage: bash scripts/demo-complete-setup.sh

# Point these at your own deployment. Do not commit live keys or production ids.
PROD_URL="${PROD_URL:-https://your-deployment.example}"
LANDING_URL="${LANDING_URL:-https://example.com/product}"
ADV_KEY="${ADV_KEY:-swarm_live_EXAMPLE_ADVERTISER_KEY}"
ADV_ID="${ADV_ID:-00000000-0000-4000-8000-000000000001}"
CAMP_ID="${CAMP_ID:-00000000-0000-4000-8000-000000000002}"
AFF_KEY="${AFF_KEY:-swarm_live_EXAMPLE_AFFILIATE_KEY}"
AFF_ID="${AFF_ID:-00000000-0000-4000-8000-000000000003}"

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
