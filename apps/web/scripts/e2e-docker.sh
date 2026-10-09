#!/usr/bin/env sh
# Runs the end-to-end tests of the web app in the official Playwright image, the environment of
# the CI job: same Chromium, same fonts, so the reference screenshots compare equal. Arguments go
# to `playwright test` (for instance --update-snapshots after an intended visual change).
# E2E_SKIP_BUILD=1 serves the .next-e2e build already there; PLAYWRIGHT_FAIL_ON_FLAKY=1 fails the
# run on a test that only passes on its retry (playwright.config.ts).
set -eu

image="mcr.microsoft.com/playwright:v1.64.0-noble"
root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

exec docker run --rm --init --ipc=host --network host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI="${CI:-}" \
  -e PLAYWRIGHT_IMAGE=1 -e E2E_SKIP_BUILD="${E2E_SKIP_BUILD:-}" \
  -e PLAYWRIGHT_FAIL_ON_FLAKY="${PLAYWRIGHT_FAIL_ON_FLAKY:-}" -v "$root:/work" -w /work/apps/web \
  "$image" node_modules/.bin/playwright test "$@"
