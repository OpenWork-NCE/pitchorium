#!/usr/bin/env sh
# Lighthouse CI on the production build of the end-to-end tests (ADR 0090): mobile profile,
# budgets of lighthouserc.cjs. Chrome is found by chrome-launcher (CHROME_PATH to choose it).
# LHCI_RUNS: runs per page (3 by default); LHCI_SCOPE=representative: one page of each kind
# (ADR 0123); LHCI_SKIP_BUILD=1: the .next-e2e build already there (built once per CI run).
set -eu
cd "$(dirname "$0")/.."
[ "${LHCI_SKIP_BUILD:-0}" = "1" ] || NEXT_DIST_DIR=.next-e2e \
  NEXT_PUBLIC_SITE_URL=http://localhost:3201 \
  NEXT_PUBLIC_API_URL=http://localhost:3299 \
  NEXT_PUBLIC_CDN_URL=http://localhost:3299/files \
  NEXT_PUBLIC_VERCEL_ANALYTICS=false \
  NEXT_PUBLIC_SENTRY_DSN= \
  ./node_modules/.bin/next build
# The same emulated phone on any host (ADR 0090): Lighthouse measures the speed of the processor
# (benchmarkIndex) on a light page, and the slowdown brings it to the index of the device the
# budgets were set on (740: a runner of index 2 960 slowed four times). A fixed slowdown measured
# the runner instead (index 2 300 to 3 000 from one CI run to the next, the feed between 190 and
# 400 ms of blocking time). LHCI_CPU_SLOWDOWN set by hand wins.
if [ -z "${LHCI_CPU_SLOWDOWN:-}" ]; then
  rm -rf .lighthouseci
  LHCI_RUNS=1 ./node_modules/.bin/lhci collect --url=http://localhost:3201/fr >/dev/null
  LHCI_CPU_SLOWDOWN=$(node -e '
    const { readdirSync, readFileSync } = require("node:fs");
    const file = readdirSync(".lighthouseci").find((name) => /^lhr-.*\.json$/.test(name));
    const index = JSON.parse(readFileSync(`.lighthouseci/${file}`, "utf8")).environment.benchmarkIndex;
    process.stdout.write(String(Math.max(1, Math.round((index / 740) * 10) / 10)));
  ')
  rm -rf .lighthouseci
  export LHCI_CPU_SLOWDOWN
  echo "Processor slowed ${LHCI_CPU_SLOWDOWN} times (emulated benchmark index 740)."
fi
# Signed in for the member space, then as a visitor for the public pages of resources.
./node_modules/.bin/lhci collect
LHCI_VISITOR=1 ./node_modules/.bin/lhci collect --additive
./node_modules/.bin/lhci assert
exec ./node_modules/.bin/lhci upload
