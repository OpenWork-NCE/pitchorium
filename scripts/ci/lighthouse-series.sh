#!/usr/bin/env bash
# A series of Lighthouse runs of one page, for each commit given, on the same runner (ADR 0142,
# docs/architecture/testing.md): one worktree per commit, its packages and its .next-e2e built, then
# RUNS runs of the page with its own lighthouserc.cjs, signed in as for the level 2. The processor
# is calibrated once, on the first commit (median of three samples, as scripts/lighthouse.sh), and
# the same slowdown serves every series, so that two series differ only by their code. Prints each Total Blocking Time, the median, the spread
# (minimum, maximum, interquartile range), each Largest Contentful Paint and its median, and writes
# them to $SERIES_OUT (series.json).
#
#   bash scripts/ci/lighthouse-series.sh /fr/feed 10 c0a5941b bc7e7ec7
set -euo pipefail
page=$1
runs=$2
shift 2
root=$(pwd)
out=${SERIES_OUT:-$root/series}
mkdir -p "$out"
case "$runs" in '' | *[!0-9]*) echo "runs must be a number" >&2; exit 2 ;; esac
case "$page" in /*) ;; *) echo "the page is a path, like /fr/feed" >&2; exit 2 ;; esac

for ref in "$@"; do
  sha=$(git rev-parse --verify "$ref^{commit}")
  tree="$RUNNER_TEMP/series-$sha"
  git worktree add --detach "$tree" "$sha" >/dev/null
  (
    cd "$tree"
    pnpm install --frozen-lockfile >/dev/null
    cp apps/web/.env.example apps/web/.env
    pnpm turbo run build --filter=@pitchorium/web^... >/dev/null
    sh apps/web/scripts/build-e2e.sh >/dev/null
    cd apps/web
    if [ -z "${LHCI_CPU_SLOWDOWN:-}" ]; then
      rm -rf .lighthouseci
      LHCI_RUNS=3 ./node_modules/.bin/lhci collect --url=http://localhost:3201/fr >/dev/null
      node -e '
        const { readdirSync, readFileSync } = require("node:fs");
        const indexes = readdirSync(".lighthouseci")
          .filter((name) => /^lhr-.*\.json$/.test(name))
          .map((name) => JSON.parse(readFileSync(`.lighthouseci/${name}`, "utf8")).environment.benchmarkIndex)
          .sort((a, b) => a - b);
        const index = indexes[Math.floor(indexes.length / 2)];
        process.stdout.write(String(Math.max(1, Math.round((index / 740) * 10) / 10)));
      ' >"$out/slowdown"
    fi
    rm -rf .lighthouseci
    LHCI_CPU_SLOWDOWN=${LHCI_CPU_SLOWDOWN:-$(cat "$out/slowdown")} LHCI_RUNS=$runs \
      ./node_modules/.bin/lhci collect --url="http://localhost:3201$page" >/dev/null
    mkdir -p "$out/$sha"
    cp .lighthouseci/lhr-*.json "$out/$sha/"
  )
  export LHCI_CPU_SLOWDOWN=${LHCI_CPU_SLOWDOWN:-$(cat "$out/slowdown")}
  echo "Processor slowed ${LHCI_CPU_SLOWDOWN} times; $ref ($sha) measured."
done

node - "$out" "$@" <<'EOF'
const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const [out, ...refs] = process.argv.slice(2);
const quantile = (sorted, q) => {
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  return sorted[low] + (sorted[Math.ceil(at)] - sorted[low]) * (at - low);
};
const series = refs.map((ref) => {
  const sha = execFileSync('git', ['rev-parse', `${ref}^{commit}`]).toString().trim();
  const runs = readdirSync(`${out}/${sha}`).map((file) => {
    const report = JSON.parse(readFileSync(`${out}/${sha}/${file}`, 'utf8'));
    return {
      tbt: Math.round(report.audits['total-blocking-time'].numericValue),
      lcp: Math.round(report.audits['largest-contentful-paint'].numericValue),
      benchmarkIndex: Math.round(report.environment.benchmarkIndex),
    };
  });
  const sorted = runs.map((run) => run.tbt).sort((a, b) => a - b);
  const lcp = runs.map((run) => run.lcp).sort((a, b) => a - b);
  return {
    ref,
    sha,
    tbt: runs.map((run) => run.tbt),
    benchmarkIndex: runs.map((run) => run.benchmarkIndex),
    median: quantile(sorted, 0.5),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    iqr: quantile(sorted, 0.75) - quantile(sorted, 0.25),
    lcp: runs.map((run) => run.lcp),
    lcpMedian: quantile(lcp, 0.5),
  };
});
writeFileSync(`${out}/series.json`, `${JSON.stringify(series, null, 2)}\n`);
for (const s of series) {
  console.log(`${s.ref}: TBT ${s.tbt.join(', ')} ms`);
  console.log(`  median ${s.median}, min ${s.min}, max ${s.max}, interquartile range ${s.iqr}`);
  console.log(`  LCP ${s.lcp.join(', ')} ms, median ${s.lcpMedian}`);
  console.log(`  benchmark index ${s.benchmarkIndex.join(', ')}`);
}
EOF
