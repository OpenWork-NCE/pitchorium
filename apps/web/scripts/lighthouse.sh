#!/usr/bin/env sh
# Lighthouse CI on the production build of the end-to-end tests (ADR 0090): mobile profile,
# budgets of lighthouserc.cjs. Chrome is found by chrome-launcher (CHROME_PATH to choose it).
# LHCI_RUNS: runs per page (3 by default); LHCI_SCOPE=representative: one page of each kind
# (ADR 0123); LHCI_SKIP_BUILD=1: the .next-e2e build already there (built once per CI run).
set -eu
cd "$(dirname "$0")/.."
[ "${LHCI_SKIP_BUILD:-0}" = "1" ] || sh scripts/build-e2e.sh
# The same emulated phone on any host (ADR 0090): Lighthouse measures the speed of the processor
# (benchmarkIndex) on a light page, and the slowdown brings it to the index of the device the
# budgets were set on (740: a runner of index 2 960 slowed four times). A fixed slowdown measured
# the runner instead (index 2 300 to 3 000 from one CI run to the next, the feed between 190 and
# 400 ms of blocking time). The index is the median of three samples (ADR 0163): one sample varied
# by 9 % on the same runner, and gave slowdowns from 3.3 to 5.7 between runs. LHCI_CPU_SLOWDOWN
# set by hand wins.
if [ -z "${LHCI_CPU_SLOWDOWN:-}" ]; then
  rm -rf .lighthouseci
  LHCI_RUNS=3 ./node_modules/.bin/lhci collect --url=http://localhost:3201/fr >/dev/null
  LHCI_CPU_SLOWDOWN=$(node -e '
    const { readdirSync, readFileSync } = require("node:fs");
    const indexes = readdirSync(".lighthouseci")
      .filter((name) => /^lhr-.*\.json$/.test(name))
      .map((name) => JSON.parse(readFileSync(`.lighthouseci/${name}`, "utf8")).environment.benchmarkIndex)
      .sort((a, b) => a - b);
    const index = indexes[Math.floor(indexes.length / 2)];
    process.stdout.write(String(Math.max(1, Math.round((index / 740) * 10) / 10)));
  ')
  rm -rf .lighthouseci
  export LHCI_CPU_SLOWDOWN
  echo "Processor slowed ${LHCI_CPU_SLOWDOWN} times (emulated benchmark index 740)."
fi
# Signed in for the member space, then as a visitor for the public pages of resources.
./node_modules/.bin/lhci collect
# The feed is judged on the median of three runs (ADR 0163): at one run per page (level 2), it gets
# the two others.
runs=${LHCI_RUNS:-3}
if [ "$runs" -lt 3 ]; then
  ./node_modules/.bin/lhci collect --additive --url=http://localhost:3201/fr/feed \
    --numberOfRuns=$((3 - runs))
fi
LHCI_VISITOR=1 ./node_modules/.bin/lhci collect --additive
./node_modules/.bin/lhci assert
exec ./node_modules/.bin/lhci upload
