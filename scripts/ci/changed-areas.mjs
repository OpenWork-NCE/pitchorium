// Areas touched by a push or a pull request, for the path filters of the CI (ADR 0123). Prudent:
// when the base is unknown or a shared file changes, every area is marked as changed.
// Usage: node scripts/ci/changed-areas.mjs <base> <head>; writes code, web and visual (true or
// false) to $GITHUB_OUTPUT when set, and prints them.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const [base, head = 'HEAD'] = process.argv.slice(2);

/** Every changed path, or undefined when the comparison is not possible. */
function changedFiles() {
  if (!base || /^0+$/.test(base)) return undefined;
  try {
    const output = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
      encoding: 'utf8',
    });
    return output.split('\n').filter(Boolean);
  } catch {
    return undefined;
  }
}

/** Documentation only: checked by the formatting and box-drawing job. */
const isDocumentation = (file) => file.startsWith('docs/') || /\.md$/.test(file);
/** Files that every job reads: the workflows, the tooling, the lockfile, the root configuration. */
const isShared = (file) =>
  file.startsWith('.github/') ||
  file.startsWith('scripts/') ||
  file.startsWith('infra/') ||
  !file.includes('/');
/** Read by the api only: its source, tests, scripts and configuration. */
const isServerOnly = (file) => file.startsWith('apps/server/');
/** Rendered by Storybook and the review captures. */
const isVisual = (file) =>
  /^apps\/web\/(\.storybook\/|src\/stories\/|src\/styles\/|e2e\/review\/)/.test(file) ||
  /^apps\/web\/src\/.*\/components\//.test(file) ||
  /\.stories\.tsx?$/.test(file) ||
  /^apps\/web\/(package\.json|playwright\.review\.config\.ts)$/.test(file) ||
  file.startsWith('docs/design/review/') ||
  file.startsWith('packages/i18n/') ||
  /tokens/.test(file);

const files = changedFiles();
const areas = files
  ? (() => {
      const code = files.filter((file) => !isDocumentation(file) || isShared(file));
      const shared = code.some(isShared);
      return {
        code: code.length > 0,
        web: shared || code.some((file) => !isServerOnly(file)),
        visual: shared || files.some(isVisual),
      };
    })()
  : { code: true, web: true, visual: true };

const lines = Object.entries(areas).map(([name, value]) => `${name}=${value}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
process.stdout.write(
  `${files ? `${files.length} changed file(s) since ${base}` : 'Unknown base: every area'}\n` +
    `${lines.join('\n')}\n`,
);
