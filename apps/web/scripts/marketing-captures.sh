#!/usr/bin/env sh
# Previews of the product for the public site (docs/design/marketing-captures.md): builds the
# end-to-end build (.next-e2e) served with the stub api and its demonstration data, captures the
# sections of e2e/marketing in the official Playwright image (fixed clock, less motion, fonts
# loaded, both themes, 2x), then encodes them into public/marketing (AVIF and WebP, several
# widths). MARKETING_SKIP_BUILD=1 reuses .next-e2e.
set -eu
cd "$(dirname "$0")/.."
if [ "${MARKETING_SKIP_BUILD:-0}" != "1" ]; then
  sh scripts/build-e2e.sh
fi
rm -rf .marketing-raw
root="$(git rev-parse --show-toplevel)"
docker run --rm --init --ipc=host --network host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$root:/work" -w /work/apps/web \
  "mcr.microsoft.com/playwright:v1.64.0-noble" \
  node_modules/.bin/playwright test --config playwright.marketing.config.ts "$@"
node scripts/marketing-encode.mjs
