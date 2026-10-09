// Summary of a Playwright run for the page of the CI run (ADR 0123): the tests that failed and
// the flaky ones, those that only passed on their retry. A flaky test is reported, never hidden:
// level 3 fails on it (PLAYWRIGHT_FAIL_ON_FLAKY=1).
// Usage: node scripts/ci/playwright-summary.mjs <results.json> <title>
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const [file, title = 'Playwright'] = process.argv.slice(2);
if (!file || !existsSync(file)) {
  process.stdout.write(`No report at ${file}.\n`);
  process.exit(0);
}
const report = JSON.parse(readFileSync(file, 'utf8'));

const found = { flaky: [], unexpected: [] };
const visit = (suite, path) => {
  for (const child of suite.suites ?? []) visit(child, [...path, child.title]);
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      if (test.status in found) {
        const name = [...path, spec.title].filter(Boolean).join(' › ');
        found[test.status].push(`[${test.projectName}] ${spec.file}:${spec.line} › ${name}`);
      }
    }
  }
};
for (const suite of report.suites ?? []) visit(suite, []);

const { expected = 0, skipped = 0, duration = 0 } = report.stats ?? {};
const section = (heading, tests) =>
  tests.length > 0 ? `\n**${heading}**\n\n${tests.map((test) => `- ${test}`).join('\n')}\n` : '';
const text =
  `### ${title}\n\n` +
  `${expected} passed, ${found.unexpected.length} failed, ${found.flaky.length} flaky, ` +
  `${skipped} skipped, ${Math.round(duration / 1000)} s\n` +
  section('Failed', found.unexpected) +
  section('Flaky (passed on retry only: to fix, level 3 fails on it)', found.flaky);
process.stdout.write(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
