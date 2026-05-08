# Local CI/CD Loop for AffiliateSwarm

## Problem We Are Solving

When local testing is unreliable, changes tend to go straight to production for validation.
This creates a high-risk workflow: bugs are discovered late, and production becomes the test environment.

We want a local loop where:

1. Every commit refreshes the local deployment automatically.
2. Every push is blocked unless core API smoke tests pass.
3. The setup is repeatable for future you (and other developers).

## What Was Added

- `scripts/bootstrap-local.sh`
  - Initializes local `.env`
  - Starts Docker Postgres/Redis
  - Handles port conflicts with an existing local Postgres (`5432` -> `5433` for Docker)
  - Runs Prisma migrations and seed
  - Starts dev server

- `tests/smoke-test-local.sh`
  - Exercises unauthenticated, authenticated, and email-verified gated API flows
  - Covers affiliate + advertiser roles and a core campaign/lead lifecycle

- `docker-compose.app.yml`
  - Adds an `app` service to run AffiliateSwarm in Docker
  - Uses existing Postgres/Redis services from `docker-compose.yml`

- `scripts/local-redeploy.sh`
  - Rebuilds and restarts Docker `app` service while keeping DB infra up

- Git hook templates:
  - `scripts/hooks/post-commit`: run local Docker redeploy after every commit
  - `scripts/hooks/pre-push`: run smoke test gate before every push

- `scripts/install-git-hooks.sh`
  - Installs/symlinks the hooks into `.git/hooks`

## Day-to-Day Workflow

### First-time setup or recovery

```bash
./scripts/bootstrap-local.sh
```

### Install automation once

```bash
./scripts/install-git-hooks.sh
```

### Normal coding

1. Run app locally (`npm run dev`) if not already running.
2. Make changes.
3. Commit.
   - `post-commit` hook automatically rebuilds/restarts Docker app deployment.
4. Push.
   - `pre-push` hook runs smoke tests and blocks push on failure.

## Why This Helps

- You stop depending on production for basic validation.
- Local deployment stays close to what you are shipping.
- Broken behavior is caught before it reaches remote branches.
- The process is explicit and repeatable, not tribal knowledge.

## Notes

- Rebuilding on every commit is intentionally strict and may slow commit flow.
- If commit speed becomes painful, move `local-redeploy.sh` from `post-commit` to `pre-push` and keep fast local iteration with `npm run dev`.
- Git hooks are local and not version-enforced by Git itself; each clone needs `./scripts/install-git-hooks.sh` once.
