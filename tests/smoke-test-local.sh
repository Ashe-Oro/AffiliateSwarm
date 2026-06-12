#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
# Secret for the gated /api/test/* routes when the app runs NODE_ENV=production
# (see docker-compose.app.yml). No baked-in default — fall back to the value in
# .env, which bootstrap-local.sh generates and Docker Compose loads into the app
# container so both sides match. Sent on every request; ignored by other routes.
if [ -z "${TEST_ROUTES_SECRET:-}" ] && [ -f .env ]; then
  TEST_ROUTES_SECRET="$(grep -E '^TEST_ROUTES_SECRET=' .env 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true)"
fi
if [ -z "${TEST_ROUTES_SECRET:-}" ]; then
  echo "TEST_ROUTES_SECRET is not set. Run scripts/bootstrap-local.sh (writes it to .env), or export it to match the running app." >&2
  exit 1
fi

require_cmd() {
  command -v "$1" >/dev/null || {
    echo "Missing required command: $1"
    exit 1
  }
}

require_cmd curl
require_cmd node

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

VERBOSE="${SMOKE_VERBOSE:-0}"

log() {
  if [ "$VERBOSE" = "1" ]; then
    echo "$1"
  fi
}

request() {
  local name="$1"
  local expected="$2"
  local method="$3"
  local path="$4"
  local body="${5:-}"
  local auth="${6:-}"

  local out_file="$TMP_DIR/${name}.out"
  local http_code

  if [ -n "$body" ] && [ -n "$auth" ]; then
    http_code="$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -H "x-test-secret: $TEST_ROUTES_SECRET" -H "Authorization: Bearer $auth" -d "$body")"
  elif [ -n "$body" ]; then
    http_code="$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -H "x-test-secret: $TEST_ROUTES_SECRET" -d "$body")"
  elif [ -n "$auth" ]; then
    http_code="$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "x-test-secret: $TEST_ROUTES_SECRET" -H "Authorization: Bearer $auth")"
  else
    http_code="$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "x-test-secret: $TEST_ROUTES_SECRET")"
  fi

  if [ "$http_code" = "$expected" ]; then
    echo "PASS  $name ($method $path -> $http_code)"
  else
    echo "FAIL  $name ($method $path -> got $http_code, expected $expected)"
    echo "---- Response body ----"
    sed -n '1,40p' "$out_file"
    exit 1
  fi
}

request_any() {
  local name="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  local auth="${5:-}"
  shift 5 || true
  local allowed=("$@")

  local out_file="$TMP_DIR/${name}.out"
  local http_code

  if [ -n "$body" ] && [ -n "$auth" ]; then
    http_code="$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -H "x-test-secret: $TEST_ROUTES_SECRET" -H "Authorization: Bearer $auth" -d "$body")"
  elif [ -n "$body" ]; then
    http_code="$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -H "x-test-secret: $TEST_ROUTES_SECRET" -d "$body")"
  elif [ -n "$auth" ]; then
    http_code="$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "x-test-secret: $TEST_ROUTES_SECRET" -H "Authorization: Bearer $auth")"
  else
    http_code="$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "x-test-secret: $TEST_ROUTES_SECRET")"
  fi

  local ok="0"
  local allowed_str=""
  for code in "${allowed[@]}"; do
    if [ "$http_code" = "$code" ]; then
      ok="1"
    fi
    if [ -z "$allowed_str" ]; then
      allowed_str="$code"
    else
      allowed_str="$allowed_str/$code"
    fi
  done

  if [ "$ok" = "1" ]; then
    echo "PASS  $name ($method $path -> $http_code)"
  else
    echo "FAIL  $name ($method $path -> got $http_code, expected one of $allowed_str)"
    echo "---- Response body ----"
    sed -n '1,60p' "$out_file"
    exit 1
  fi
}

echo "==> Running local smoke tests against $BASE_URL"

# 1) API reachability + auth guard works (no token)
request "me-unauthorized" "401" "GET" "/api/v1/me"

# 2) Register a fresh test agent and collect API key
RAND="$(date +%s)$RANDOM"
REGISTER_PAYLOAD="{\"type\":\"AFFILIATE\",\"displayName\":\"Smoke Test Agent $RAND\",\"email\":\"smoke+$RAND@example.com\",\"capabilities\":[\"LEAD_SUBMIT\"]}"
request "register-agent" "201" "POST" "/api/v1/agents" "$REGISTER_PAYLOAD"

REGISTER_JSON="$(cat "$TMP_DIR/register-agent.out")"
API_KEY="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d?.data?.apiKey || "");' "$REGISTER_JSON")"
AGENT_ID="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d?.data?.agent?.id || "");' "$REGISTER_JSON")"

if [ -z "$API_KEY" ] || [ -z "$AGENT_ID" ]; then
  echo "FAIL  Could not extract apiKey/agentId from registration response"
  sed -n '1,40p' "$TMP_DIR/register-agent.out"
  exit 1
fi

# Also register advertiser for role-gated checks
ADV_PAYLOAD="{\"type\":\"ADVERTISER\",\"displayName\":\"Smoke Test Advertiser $RAND\",\"email\":\"smoke-adv+$RAND@example.com\",\"capabilities\":[\"CAMPAIGN_CREATE\",\"CAMPAIGN_MANAGE\"]}"
request "register-advertiser" "201" "POST" "/api/v1/agents" "$ADV_PAYLOAD"

ADV_JSON="$(cat "$TMP_DIR/register-advertiser.out")"
ADV_KEY="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d?.data?.apiKey || "");' "$ADV_JSON")"
ADV_AGENT_ID="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d?.data?.agent?.id || "");' "$ADV_JSON")"

if [ -z "$ADV_KEY" ] || [ -z "$ADV_AGENT_ID" ]; then
  echo "FAIL  Could not extract advertiser apiKey/agentId from registration response"
  sed -n '1,60p' "$TMP_DIR/register-advertiser.out"
  exit 1
fi

log "affiliate=$AGENT_ID advertiser=$ADV_AGENT_ID"

# 4) Authenticated endpoints using that API key
request "me-authorized" "200" "GET" "/api/v1/me" "" "$API_KEY"
request "wallet-self" "200" "GET" "/api/v1/wallets" "" "$API_KEY"
request "agent-profile" "200" "GET" "/api/v1/agents/$AGENT_ID" "" "$API_KEY"

request "adv-me-authorized" "200" "GET" "/api/v1/me" "" "$ADV_KEY"
request "adv-wallet-self" "200" "GET" "/api/v1/wallets" "" "$ADV_KEY"
request "adv-agent-profile" "200" "GET" "/api/v1/agents/$ADV_AGENT_ID" "" "$ADV_KEY"

# 5) Discover endpoint should work before email verification
DISCOVER_CODE="$(curl -sS -o "$TMP_DIR/discover.out" -w "%{http_code}" -X GET "$BASE_URL/api/v1/discover/campaigns" -H "Authorization: Bearer $API_KEY")"
if [ "$DISCOVER_CODE" = "200" ]; then
  echo "PASS  discover-campaigns (GET /api/v1/discover/campaigns -> $DISCOVER_CODE)"
else
  echo "FAIL  discover-campaigns (got $DISCOVER_CODE, expected 200)"
  sed -n '1,40p' "$TMP_DIR/discover.out"
  exit 1
fi

# 6) Verify both emails via test helper (dev only)
VERIFY_AFF_PAYLOAD="{\"agentId\":\"$AGENT_ID\"}"
VERIFY_ADV_PAYLOAD="{\"agentId\":\"$ADV_AGENT_ID\"}"
request "verify-email-affiliate" "200" "POST" "/api/test/verify-email" "$VERIFY_AFF_PAYLOAD"
request "verify-email-advertiser" "200" "POST" "/api/test/verify-email" "$VERIFY_ADV_PAYLOAD"

# 7) Email-verified route checks
request "discover-campaigns-verified" "200" "GET" "/api/v1/discover/campaigns" "" "$API_KEY"

# 8) End-to-end core workflow with gated routes
CAMPAIGN_PAYLOAD='{"name":"Smoke Test Campaign","compensationModel":"CPL","payoutPerUnitCents":500,"currency":"USD","budgetCents":100000,"enrollmentPolicy":"OPEN","requiresVerification":true}'
request "create-campaign" "201" "POST" "/api/v1/campaigns" "$CAMPAIGN_PAYLOAD" "$ADV_KEY"

CAMPAIGN_JSON="$(cat "$TMP_DIR/create-campaign.out")"
CAMPAIGN_ID="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d?.data?.campaign?.id || "");' "$CAMPAIGN_JSON")"
TEST_TRACKING_CODE="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d?.data?.campaign?.testTrackingCode || "");' "$CAMPAIGN_JSON")"
if [ -z "$CAMPAIGN_ID" ]; then
  echo "FAIL  Could not extract campaignId from create-campaign response"
  sed -n '1,80p' "$TMP_DIR/create-campaign.out"
  exit 1
fi

# Credit the advertiser's wallet directly (test-only endpoint). Under the
# wallet-first model there's no per-campaign deposit API — campaigns
# auto-draw from wallet balance at conversion time.
CREDIT_PAYLOAD="{\"agentId\":\"$ADV_AGENT_ID\",\"amountCents\":10000}"
request "credit-wallet" "200" "POST" "/api/test/credit-wallet" "$CREDIT_PAYLOAD"

# Confirm tracking by firing a test postback with the campaign's testTrackingCode
CONFIRM_PAYLOAD="{\"swarm_ref\":\"$TEST_TRACKING_CODE\",\"externalId\":\"smoke-confirm-$RAND\",\"eventType\":\"PURCHASE\"}"
request "confirm-tracking" "200" "POST" "/api/v1/postback" "$CONFIRM_PAYLOAD" "$ADV_KEY"
request "activate-campaign" "200" "POST" "/api/v1/campaigns/$CAMPAIGN_ID/activate" "{}" "$ADV_KEY"

request_any "apply-to-campaign" "POST" "/api/v1/campaigns/$CAMPAIGN_ID/applications" '{"pitch":"Smoke test affiliate application"}' "$API_KEY" "200" "201"

APPLY_JSON="$(cat "$TMP_DIR/apply-to-campaign.out")"
APP_STATUS="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d?.data?.status || "");' "$APPLY_JSON")"
TRACKING_CODE="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d?.data?.trackingCode || "");' "$APPLY_JSON")"

if [ "$APP_STATUS" = "PENDING" ] || [ -z "$TRACKING_CODE" ]; then
  APPLICATION_LIST_CODE="$(curl -sS -o "$TMP_DIR/list-applications.out" -w "%{http_code}" -X GET "$BASE_URL/api/v1/campaigns/$CAMPAIGN_ID/applications" -H "Authorization: Bearer $ADV_KEY")"
  if [ "$APPLICATION_LIST_CODE" = "200" ]; then
    echo "PASS  list-applications (GET /api/v1/campaigns/$CAMPAIGN_ID/applications -> 200)"
  else
    echo "FAIL  list-applications (got $APPLICATION_LIST_CODE, expected 200)"
    sed -n '1,80p' "$TMP_DIR/list-applications.out"
    exit 1
  fi

  APP_ID="$(node -e 'const d=JSON.parse(process.argv[1]); const arr=d?.data; process.stdout.write(Array.isArray(arr)&&arr.length>0 ? (arr[0].id||"") : "");' "$(cat "$TMP_DIR/list-applications.out")")"
  if [ -z "$APP_ID" ]; then
    echo "FAIL  Could not extract application id from list-applications response"
    sed -n '1,80p' "$TMP_DIR/list-applications.out"
    exit 1
  fi

  request "approve-application" "200" "PATCH" "/api/v1/campaigns/$CAMPAIGN_ID/applications/$APP_ID" '{"decision":"APPROVED"}' "$ADV_KEY"

  TRACKING_CODE="$(node -e 'const d=JSON.parse(process.argv[1]); process.stdout.write(d?.data?.trackingCode || "");' "$(cat "$TMP_DIR/approve-application.out")")"
fi

if [ -z "$TRACKING_CODE" ]; then
  echo "FAIL  Could not extract tracking code from application flow"
  sed -n '1,100p' "$TMP_DIR/apply-to-campaign.out"
  exit 1
fi

LEAD_PAYLOAD="{\"campaignId\":\"$CAMPAIGN_ID\",\"trackingCode\":\"$TRACKING_CODE\",\"externalId\":\"smoke-lead-$RAND\",\"leadData\":{\"email\":\"lead+$RAND@example.com\",\"company\":\"Smoke Co\"}}"
request "submit-lead" "201" "POST" "/api/v1/leads" "$LEAD_PAYLOAD" "$API_KEY"
request "list-leads-affiliate" "200" "GET" "/api/v1/leads" "" "$API_KEY"
request "list-leads-advertiser" "200" "GET" "/api/v1/leads" "" "$ADV_KEY"

echo
echo "==> Smoke test complete"
echo "    Affiliate Agent ID: $AGENT_ID"
echo "    Advertiser Agent ID: $ADV_AGENT_ID"
echo "    Campaign ID: $CAMPAIGN_ID"
echo "    Result: local core + email-verified gated API flow is healthy"
