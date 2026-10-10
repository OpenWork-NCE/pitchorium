#!/usr/bin/env bash
# Journeys of the web app against the real api (docs/architecture/frontend.md), from scratch, the
# way the end-to-end suite of the server runs: an isolated Docker Compose project (PostgreSQL,
# Valkey, MinIO, Mailpit; the worker scans with the test adapter of the antivirus, ADR 0126) on
# dedicated ports, the migrations and the demonstration data,
# the built api, worker and web app, the fake OAuth providers (a service a browser reaches), then
# Playwright in its official image (Chromium, Firefox, WebKit). Cloudflare Turnstile runs with its
# official test keys, unless LIVE_TURNSTILE=0. Everything this script starts is stopped by its own process group id or
# Compose project; nothing else is touched.
#
# Environment:
#   LIVE_PROJECT        Compose project name (default: pitchorium-live)
#   LIVE_PORT_OFFSET    added to the default port of every service and process (default: 30000)
#   LIVE_KEEP           1 keeps the Compose project and prints the logs directory
#   LIVE_SKIP_BUILD     1 reuses the builds already there (a previous run, or the build job of the
#                       CI with the same LIVE_PORT_OFFSET: the addresses are part of the web build)
#   LIVE_BUILD_ONLY     1 builds the packages, the api, the worker and the web app, then stops
#   PLAYWRIGHT_FAIL_ON_FLAKY  1 fails on a journey that only passes on its retry (level 3)
#   LIVE_LOGS           directory of the logs of the services and processes (default: a new one)
#   LIVE_TURNSTILE      0 runs without Cloudflare Turnstile (no widget, no call of the api to
#                       Cloudflare): the journeys of level 3 that do not depend on an external
#                       service, the ones tagged @external running in their own job (ADR 0127)
# Arguments go to `playwright test` (for instance a file or --project=chromium).
set -euo pipefail

root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
project="${LIVE_PROJECT:-pitchorium-live}"
offset="${LIVE_PORT_OFFSET:-30000}"
image="mcr.microsoft.com/playwright:v1.64.0-noble"
logs="${LIVE_LOGS:-$(mktemp -d "${TMPDIR:-/tmp}/pitchorium-live.XXXXXX")}"
mkdir -p "$logs"

if [ "$project" = "pitchorium" ]; then
  echo "LIVE_PROJECT must differ from the everyday project name (pitchorium)." >&2
  exit 2
fi

export COMPOSE_PROJECT_NAME="$project"
export PITCHORIUM_POSTGRES_PORT=$((5432 + offset))
export PITCHORIUM_VALKEY_PORT=$((6379 + offset))
export PITCHORIUM_MINIO_PORT=$((9000 + offset))
export PITCHORIUM_MINIO_CONSOLE_PORT=$((9001 + offset))
export PITCHORIUM_MAILPIT_SMTP_PORT=$((1025 + offset))
export PITCHORIUM_MAILPIT_UI_PORT=$((8025 + offset))
api_port=$((3000 + offset))
worker_port=$((3001 + offset))
web_port=$((3200 + offset))
oauth_port=$((3400 + offset))
export TURBO_TELEMETRY_DISABLED=1

# A port already in use belongs to someone else: stop rather than share or kill it.
[ "${LIVE_BUILD_ONLY:-0}" = "1" ] || for port in "$PITCHORIUM_POSTGRES_PORT" "$PITCHORIUM_VALKEY_PORT" "$PITCHORIUM_MINIO_PORT" \
  "$PITCHORIUM_MINIO_CONSOLE_PORT" "$PITCHORIUM_MAILPIT_SMTP_PORT" "$PITCHORIUM_MAILPIT_UI_PORT" \
  "$api_port" "$worker_port" "$web_port" "$oauth_port"; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo "Port $port is already in use: choose another LIVE_PORT_OFFSET." >&2
    exit 2
  fi
done

compose=(docker compose -p "$project" -f "$root/infra/docker/compose.yaml")
groups=()

cleanup() {
  local status=$?
  if [ "${LIVE_BUILD_ONLY:-0}" = "1" ]; then
    echo "Logs: $logs"
    exit "$status"
  fi
  # Only the process groups this script started, by their recorded id (AGENTS.md, rule 9).
  for group in "${groups[@]}"; do kill -TERM -- "-$group" 2>/dev/null || true; done
  for group in "${groups[@]}"; do
    for _ in $(seq 1 20); do kill -0 -- "-$group" 2>/dev/null || break; sleep 0.5; done
  done
  if [ "${LIVE_KEEP:-0}" = "1" ]; then
    echo "Kept: Compose project $project (${compose[*]} down -v), logs in $logs."
  else
    "${compose[@]}" down -v --remove-orphans >"$logs/compose-down.log" 2>&1 || true
    echo "Logs: $logs"
  fi
  exit "$status"
}
trap cleanup EXIT
# A stop (Ctrl+C, the CI cancelling the job) goes through the same cleanup.
trap 'exit 130' INT
trap 'exit 143' TERM

# Configuration of the processes: the example of the api, pointed at the isolated services.
env_file="$logs/server.env"
# Test keys of Cloudflare Turnstile (always pass), or none: the api neither asks for a challenge
# nor calls Cloudflare.
if [ "${LIVE_TURNSTILE:-1}" = "0" ]; then
  turnstile_site_key=""
  turnstile_secret_key=""
else
  turnstile_site_key="1x00000000000000000000AA"
  turnstile_secret_key="1x0000000000000000000000000000000AA"
fi
sed \
  -e "s#localhost:5432/#localhost:$PITCHORIUM_POSTGRES_PORT/#" \
  -e "s#localhost:6379#localhost:$PITCHORIUM_VALKEY_PORT#" \
  -e "s#localhost:9000#localhost:$PITCHORIUM_MINIO_PORT#g" \
  -e "s#localhost:1025#localhost:$PITCHORIUM_MAILPIT_SMTP_PORT#" \
  -e "s#localhost:3200#localhost:$web_port#g" \
  -e "s#localhost:3000#localhost:$api_port#g" \
  -e "s#^MALWARE_SCANNER=.*#MALWARE_SCANNER=eicar-only#" \
  -e "s#^API_PORT=.*#API_PORT=$api_port#" \
  -e "s#^WORKER_HEALTH_PORT=.*#WORKER_HEALTH_PORT=$worker_port#" \
  -e "s#^QUEUE_PREFIX=.*#QUEUE_PREFIX=$project#" \
  -e "s#^NODE_ENV=.*#NODE_ENV=test#" \
  -e "s#^LOG_LEVEL=.*#LOG_LEVEL=warn#" \
  -e "s#^AUTH_PWNED_PASSWORD_CHECK=.*#AUTH_PWNED_PASSWORD_CHECK=false#" \
  -e "s#^AUTH_RATE_LIMIT_MAX=.*#AUTH_RATE_LIMIT_MAX=30#" \
  -e "s#^GOOGLE_CLIENT_ID=.*#GOOGLE_CLIENT_ID=google-client#" \
  -e "s#^GOOGLE_CLIENT_SECRET=.*#GOOGLE_CLIENT_SECRET=google-secret#" \
  -e "s#^TURNSTILE_SITE_KEY=.*#TURNSTILE_SITE_KEY=$turnstile_site_key#" \
  -e "s#^TURNSTILE_SECRET_KEY=.*#TURNSTILE_SECRET_KEY=$turnstile_secret_key#" \
  -e "s#^SCHEDULED_TASKS_EVERY_MS=.*#SCHEDULED_TASKS_EVERY_MS=3000#" \
  "$root/apps/server/.env.example" | grep -v '^#' | grep -v '^$' >"$env_file"
{
  echo "FAKE_OAUTH_URL=http://127.0.0.1:$oauth_port"
  echo "FAKE_OAUTH_PORT=$oauth_port"
  # The web app, built and started for this run.
  echo "WEB_PORT=$web_port"
  echo "NEXT_DIST_DIR=.next-live"
  echo "NEXT_PUBLIC_SITE_URL=http://localhost:$web_port"
  echo "NEXT_PUBLIC_API_URL=http://localhost:$api_port"
  echo "API_INTERNAL_URL=http://localhost:$api_port"
  echo "NEXT_PUBLIC_CDN_URL=http://localhost:$PITCHORIUM_MINIO_PORT/pitchorium-public"
  echo "NEXT_PUBLIC_UPLOAD_URL=http://localhost:$PITCHORIUM_MINIO_PORT"
  echo "NEXT_PUBLIC_VERCEL_ANALYTICS=false"
} >>"$env_file"
while IFS='=' read -r key value; do export "$key=$value"; done <"$env_file"

# Runs a step, its output in a log file; stops at the first failure with the end of the log.
step() {
  local name="$1"
  shift
  local log
  log="$logs/$(echo "$name" | tr ' :/' '---').log"
  if ! "$@" >"$log" 2>&1; then
    echo "FAIL  $name, last lines of $log:" >&2
    tail -n 40 "$log" >&2
    exit 1
  fi
  echo "ok    $name"
}

# Starts a long-running process in its own process group, recorded for the cleanup.
start() {
  local name="$1"
  shift
  setsid "$@" >"$logs/$name.log" 2>&1 &
  groups+=("$!")
}

wait_ready() {
  local name="$1" url="$2"
  for _ in $(seq 1 240); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "ok    $name ready"
      return 0
    fi
    sleep 0.5
  done
  echo "FAIL  $name not ready at $url, last lines of $logs/$name.log:" >&2
  tail -n 40 "$logs/$name.log" >&2
  exit 1
}

cd "$root"
# Built first: the demonstration data runs on the built packages (a fresh clone has none).
if [ "${LIVE_SKIP_BUILD:-0}" != "1" ]; then
  step 'build of the api, the worker and the packages' \
    pnpm turbo run build --filter=@pitchorium/server... --filter=@pitchorium/web^...
  # Out of Turborepo: its strict environment would drop NEXT_DIST_DIR, and a cached .next would
  # not carry the addresses of this run.
  step 'build of the web app' bash -c 'cd apps/web && exec node_modules/.bin/next build'
fi
[ "${LIVE_BUILD_ONLY:-0}" = "1" ] && exit 0
step 'infrastructure (Compose)' "${compose[@]}" up -d --wait postgres valkey minio mailpit
step 'buckets' "${compose[@]}" run --rm minio-init
step 'migrations' pnpm db:migrate
step 'reference data' pnpm db:seed
step 'demonstration data' pnpm --filter @pitchorium/server db:seed:dev

start oauth bash -c "cd apps/server && exec node -r @swc-node/register test/oauth/server.ts"
start api bash -c "cd apps/server && exec node -r @swc-node/register -r ./test/oauth/reroute.ts dist/main.api.js"
start worker bash -c "cd apps/server && exec node -r @swc-node/register -r ./test/oauth/reroute.ts dist/main.worker.js"
start web bash -c "cd apps/web && exec node_modules/.bin/next start --port $web_port"
wait_ready oauth "http://127.0.0.1:$oauth_port/__health"
wait_ready api "http://localhost:$api_port/v1/health/ready"
wait_ready worker "http://localhost:$worker_port/health/ready"
wait_ready web "http://localhost:$web_port/fr/sign-in"

echo "Journeys (Playwright $image)"
docker run --rm --init --ipc=host --network host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI="${CI:-}" \
  -e PLAYWRIGHT_FAIL_ON_FLAKY="${PLAYWRIGHT_FAIL_ON_FLAKY:-}" \
  -e LIVE_WEB_URL="http://localhost:$web_port" \
  -e LIVE_API_URL="http://localhost:$api_port" \
  -e MAILPIT_URL="http://localhost:$PITCHORIUM_MAILPIT_UI_PORT" \
  -e FAKE_OAUTH_URL="http://127.0.0.1:$oauth_port" \
  -v "$root:/work" -w /work/apps/web \
  "$image" node_modules/.bin/playwright test -c playwright.live.config.ts "$@"
