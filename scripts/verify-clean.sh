#!/usr/bin/env bash
# Definition of done from scratch (ADR 0063): clones the committed state into a temporary
# directory, starts an isolated Docker Compose project on dedicated ports, runs every check,
# then removes the containers, the volumes and the clone. The volumes of the everyday local
# project (pitchorium_*) are never touched.
#
# Environment:
#   VERIFY_REF               commit to verify (default: HEAD of this repository)
#   VERIFY_PROJECT           Compose project name (default: pitchorium-verify)
#   VERIFY_PORT_OFFSET       added to the default port of every service (default: 20000)
#   VERIFY_KEEP              1 keeps the clone and the Compose project for inspection
set -euo pipefail

repo_root="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
ref="$(git -C "$repo_root" rev-parse "${VERIFY_REF:-HEAD}")"
project="${VERIFY_PROJECT:-pitchorium-verify}"
offset="${VERIFY_PORT_OFFSET:-20000}"

if [ "$project" = "pitchorium" ]; then
  echo "VERIFY_PROJECT must differ from the everyday project name (pitchorium)." >&2
  exit 2
fi

workdir="$(mktemp -d "${TMPDIR:-/tmp}/pitchorium-verify.XXXXXX")"
clone="$workdir/pitchorium"
logs="$workdir/logs"
mkdir -p "$logs"

export COMPOSE_PROJECT_NAME="$project"
export PITCHORIUM_POSTGRES_PORT=$((5432 + offset))
export PITCHORIUM_VALKEY_PORT=$((6379 + offset))
export PITCHORIUM_MINIO_PORT=$((9000 + offset))
export PITCHORIUM_MINIO_CONSOLE_PORT=$((9001 + offset))
export PITCHORIUM_MAILPIT_SMTP_PORT=$((1025 + offset))
export PITCHORIUM_MAILPIT_UI_PORT=$((8025 + offset))
export PITCHORIUM_CLAMAV_PORT=$((3310 + offset))
export TURBO_TELEMETRY_DISABLED=1

cleanup() {
  local status=$?
  if [ "${VERIFY_KEEP:-0}" = "1" ]; then
    echo "Kept: clone $clone, Compose project $project (docker compose -p $project down -v)."
    exit "$status"
  fi
  local compose_file="$clone/infra/docker/compose.yaml"
  [ -f "$compose_file" ] || compose_file="$repo_root/infra/docker/compose.yaml"
  docker compose -p "$project" -f "$compose_file" down -v --remove-orphans >"$logs/cleanup.log" 2>&1 ||
    echo "Cleanup of the Compose project $project failed, see $logs/cleanup.log" >&2
  local kept_logs="${TMPDIR:-/tmp}/pitchorium-verify-logs-$(date +%Y%m%d-%H%M%S)"
  mv "$logs" "$kept_logs"
  rm -rf "$workdir"
  echo "Logs: $kept_logs"
  exit "$status"
}
trap cleanup EXIT

summary=()

# Runs one step in the clone, its output in a log file; stops at the first failure.
step() {
  local name="$1"
  shift
  local log="$logs/$(echo "$name" | tr ' :/' '---').log"
  local started=$SECONDS
  if (cd "$clone" && "$@") >"$log" 2>&1; then
    summary+=("ok    $(printf '%4d' $((SECONDS - started)))s  $name")
    echo "ok    $name ($((SECONDS - started)) s)"
  else
    summary+=("FAIL  $(printf '%4d' $((SECONDS - started)))s  $name")
    echo "FAIL  $name ($((SECONDS - started)) s), last lines of $log:" >&2
    tail -n 40 "$log" >&2
    printf '%s\n' "${summary[@]}"
    exit 1
  fi
}

echo "Verifying $ref in $clone (Compose project $project, ports +$offset)"
git clone --quiet "$repo_root" "$clone"
git -C "$clone" checkout --quiet --detach "$ref"

# Local environment pointed at the isolated services.
sed \
  -e "s#localhost:5432/#localhost:$PITCHORIUM_POSTGRES_PORT/#" \
  -e "s#localhost:6379#localhost:$PITCHORIUM_VALKEY_PORT#" \
  -e "s#localhost:9000#localhost:$PITCHORIUM_MINIO_PORT#g" \
  -e "s#localhost:1025#localhost:$PITCHORIUM_MAILPIT_SMTP_PORT#" \
  -e "s#^CLAMAV_PORT=.*#CLAMAV_PORT=$PITCHORIUM_CLAMAV_PORT#" \
  -e "s#^QUEUE_PREFIX=.*#QUEUE_PREFIX=$project#" \
  "$clone/apps/server/.env.example" >"$clone/apps/server/.env"
# The web app validates its configuration when it builds (apps/web/src/lib/env.ts).
cp "$clone/apps/web/.env.example" "$clone/apps/web/.env"

step 'pnpm install' pnpm install --frozen-lockfile
step 'pnpm infra:up' pnpm infra:up
step 'pnpm db:migrate' pnpm db:migrate
step 'pnpm db:seed' pnpm db:seed
step 'pnpm db:seed:dev' pnpm db:seed:dev
step 'pnpm lint' pnpm lint
step 'pnpm typecheck' pnpm typecheck
step 'pnpm test' pnpm test
step 'pnpm test:integration' pnpm test:integration
step 'pnpm build' pnpm build
step 'web: initial JavaScript budgets' pnpm --filter @pitchorium/web check:bundles
step 'pnpm test:e2e' pnpm test:e2e
# Its own Compose project and ports, next to the one of this verification.
step 'web: journeys against the real api' env LIVE_PROJECT="$project-live" \
  LIVE_PORT_OFFSET=$((offset + 5000)) LIVE_LOGS="$logs/live" pnpm --filter @pitchorium/web test:e2e:live
step 'web: Storybook build' pnpm --filter @pitchorium/web build-storybook
step 'web: Lighthouse CI' pnpm --filter @pitchorium/web lighthouse
# On the build Lighthouse made (.next-e2e): the visitor and member views of the public pages.
step 'web: JavaScript of the visitor and member views' pnpm --filter @pitchorium/web check:bundles .next-e2e --views
step 'pnpm openapi:generate' pnpm openapi:generate
step 'pnpm api-client:generate' pnpm api-client:generate
step 'pnpm format:check' pnpm format:check
step 'pnpm check:box-drawing' pnpm check:box-drawing
step 'pnpm i18n:check' pnpm i18n:check
step 'pnpm db:check' pnpm db:check
# The generated files must equal the committed ones; .env is ignored by git.
step 'git status is empty' sh -c 'test -z "$(git status --porcelain)" || { git status --porcelain; exit 1; }'

echo
echo "Summary of $ref:"
printf '%s\n' "${summary[@]}"
