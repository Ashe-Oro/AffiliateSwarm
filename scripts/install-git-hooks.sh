#!/usr/bin/env bash
set -euo pipefail

if [ ! -d .git ]; then
  echo "Run this from the repo root (missing .git directory)."
  exit 1
fi

mkdir -p .git/hooks

ln -sf ../../scripts/hooks/post-commit .git/hooks/post-commit
ln -sf ../../scripts/hooks/pre-push .git/hooks/pre-push

chmod +x scripts/local-redeploy.sh
chmod +x scripts/hooks/post-commit
chmod +x scripts/hooks/pre-push
chmod +x scripts/install-git-hooks.sh

echo "==> Installed git hooks: post-commit, pre-push"
echo "    post-commit -> auto Docker app rebuild/redeploy"
echo "    pre-push    -> local smoke test gate"
