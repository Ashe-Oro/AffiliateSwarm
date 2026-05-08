#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "==> Local redeploy: ensuring infra"
docker compose -f docker-compose.yml up -d postgres redis

echo "==> Local redeploy: rebuilding app image"
docker compose -f docker-compose.yml -f docker-compose.app.yml build app

echo "==> Local redeploy: restarting app container"
docker compose -f docker-compose.yml -f docker-compose.app.yml up -d app

echo "==> Local redeploy complete"
