#!/usr/bin/env sh
# Audit of every screen (e2e/audit, docs/architecture/testing.md): axe in both themes, the layout
# guard in both sizes, English on a phone, then the same screens pseudo-localized (texts 40 %
# longer and accented, those written outside the catalogues refused). In the official Playwright
# image, the rendering of the CI. AUDIT_SKIP_BUILD=1 serves the .next-e2e build already there;
# AUDIT_CAPTURES=<dir> (inside the repository) writes a capture of each screen for the review of
# the direction. Arguments go to `playwright test`.
set -eu
cd "$(dirname "$0")/.."
if [ "${AUDIT_SKIP_BUILD:-0}" != "1" ]; then
  sh scripts/build-e2e.sh
fi
root="$(git rev-parse --show-toplevel)"
run() {
  pseudo="$1"
  shift
  docker run --rm --init --ipc=host --network host \
    --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI="${CI:-}" -e PLAYWRIGHT_IMAGE=1 \
    -e PLAYWRIGHT_FAIL_ON_FLAKY="${PLAYWRIGHT_FAIL_ON_FLAKY:-}" \
    -e AUDIT_PSEUDO="$pseudo" -e AUDIT_CAPTURES="${AUDIT_CAPTURES:-}" -e AUDIT_REPORT="${AUDIT_REPORT:-}" \
    -v "$root:/work" -w /work/apps/web \
    "mcr.microsoft.com/playwright:v1.64.0-noble" \
    node_modules/.bin/playwright test --config playwright.audit.config.ts "$@"
}
# Both passes run; the audit fails when either does.
status=0
run 0 "$@" || status=1
run 1 "$@" || status=1
exit "$status"
