#!/usr/bin/env sh
# Captures of the reference compositions for the design review (docs/design/review/README.md):
# builds the static Storybook, then shoots every composition in both themes at 1280x800 and
# 390x844 in the official Playwright image (same rendering as the CI). `review:captures` passes
# --update-snapshots=all to write them; `review:check` passes nothing and compares them with the
# committed captures. REVIEW_SKIP_BUILD=1 reuses storybook-static and .next-e2e (the pages of the
# projects, e2e/review/pages.review.ts, are captured on it with the stub api).
set -eu
cd "$(dirname "$0")/.."
if [ "${REVIEW_SKIP_BUILD:-0}" != "1" ]; then
  ./node_modules/.bin/storybook build --quiet
  # The pages of the projects are captured on the build of the end-to-end tests.
  sh scripts/build-e2e.sh
fi
root="$(git rev-parse --show-toplevel)"
exec docker run --rm --init --ipc=host --network host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI="${CI:-}" \
  -e PLAYWRIGHT_FAIL_ON_FLAKY="${PLAYWRIGHT_FAIL_ON_FLAKY:-}" \
  -v "$root:/work" -w /work/apps/web \
  "mcr.microsoft.com/playwright:v1.64.0-noble" \
  node_modules/.bin/playwright test --config playwright.review.config.ts "$@"
