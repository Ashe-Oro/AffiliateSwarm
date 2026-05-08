#!/usr/bin/env bash
set -euo pipefail

echo "==> AffiliateSwarm local bootstrap starting..."

# --- sanity checks ---
command -v node >/dev/null || { echo "Node is required"; exit 1; }
command -v npm >/dev/null || { echo "npm is required"; exit 1; }
command -v docker >/dev/null || { echo "Docker is required"; exit 1; }
command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }
command -v lsof >/dev/null || { echo "lsof is required"; exit 1; }

[ -f package.json ] || { echo "Run this from the AffiliateSwarm repo root"; exit 1; }
[ -f prisma/schema.prisma ] || { echo "prisma/schema.prisma not found"; exit 1; }

POSTGRES_PORT="${AFFILIATESWARM_POSTGRES_PORT:-5432}"

if lsof -n -P -iTCP:5432 -sTCP:LISTEN >/dev/null 2>&1; then
  if docker compose exec -T postgres psql -U affiliateswarm -d affiliateswarm -c '\\q' >/dev/null 2>&1; then
    POSTGRES_PORT="5432"
  else
    POSTGRES_PORT="5433"
    export AFFILIATESWARM_POSTGRES_PORT="$POSTGRES_PORT"
    echo "==> Detected local Postgres on 5432; mapping Docker Postgres to $POSTGRES_PORT"
  fi
fi

# --- env file ---
if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from .env.example"
else
  echo "==> .env already exists (keeping it)"
fi

upsert_env () {
  local key="$1"
  local value="$2"

  local tmp_file
  tmp_file="$(mktemp)"

  awk -v k="$key" -v v="$value" '
    BEGIN { replaced = 0 }
    {
      if ($0 ~ "^" k "=") {
        print k "=\"" v "\""
        replaced = 1
      } else {
        print $0
      }
    }
    END {
      if (!replaced) {
        print k "=\"" v "\""
      }
    }
  ' .env > "$tmp_file"

  mv "$tmp_file" .env
}

# Minimal required local values
upsert_env "DATABASE_URL" "postgresql://affiliateswarm:affiliateswarm_dev@localhost:${POSTGRES_PORT}/affiliateswarm?schema=public"
upsert_env "NEXT_PUBLIC_APP_URL" "http://localhost:3000"
upsert_env "NEXT_PUBLIC_SHORT_URL" "http://localhost:3000"
upsert_env "NODE_ENV" "development"
upsert_env "HMAC_ENCRYPTION_KEY" "$(openssl rand -hex 32)"
upsert_env "ADMIN_SECRET" "$(openssl rand -hex 32)"
upsert_env "CRON_SECRET" "$(openssl rand -hex 32)"

# Optional but useful local defaults
upsert_env "AFFILIATESWARM_REFERRAL_SECRET" "affiliateswarm-local-referral-secret"

echo "==> Env configured"

# --- dependencies ---
echo "==> Installing npm deps..."
npm install

# --- local infra ---
echo "==> Starting postgres + redis via docker compose..."
docker compose up -d postgres redis

echo "==> Waiting for postgres to be ready..."
until docker compose exec -T postgres pg_isready -U affiliateswarm >/dev/null 2>&1; do
  sleep 1
done

# --- database setup ---
echo "==> Applying migrations (fallback to db push if needed)..."
if ! npx prisma migrate deploy; then
  echo "==> migrate deploy failed, using prisma db push for local dev..."
  npx prisma db push
fi

echo "==> Seeding database..."
npx tsx prisma/seed.ts

echo
echo "==> Bootstrap complete."
echo "   App URL: http://localhost:3000"
echo "   Start dev server with: npm run dev"
echo
echo "==> Starting dev server now..."
npm run dev
