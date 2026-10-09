#!/usr/bin/env node
// Initial JavaScript per route group, compressed (Brotli), from the client reference manifests of
// a production build (ADR 0090, ADR 0094): fails above the budget of a group, or when a library a
// group must not carry reaches its first load (GSAP outside the editorial pages; realtime, the
// authentication client or the query devtools on the editorial and public pages). Lists the Radix
// primitives of each page: only the ones its components use may appear.
//
// Usage: node scripts/check-bundles.mjs [build directory, default .next]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

const buildDir = process.argv[2] ?? '.next';
const appDir = join(buildDir, 'server/app');

/**
 * Kilobytes of Brotli-compressed initial JavaScript per page of each group, framework included
 * (React and the Next.js runtime weigh about 112 kB): docs/architecture/frontend.md.
 */
const BUDGETS_KB = {
  // The onboarding writes like the member space (TanStack Query, upload, country search): its
  // budget, checked before the rest of the authentication group.
  '(auth)/onboarding': 250,
  '(marketing)': 190,
  // A member reads a resource (profile, organisation, network) in the shell of the member space,
  // as in (app); the manifest counts both shells, a visitor downloads the public one only.
  '(public)': 250,
  '(auth)': 220,
  '(app)': 250,
  '(admin)': 260,
  other: 190,
};

/** Libraries kept out of the first load of some groups, recognised by strings of their code. */
const FORBIDDEN = [
  {
    name: 'GSAP',
    signature: /GreenSock|gsap\.registerPlugin|_gsScope/,
    groups: ['(app)', '(admin)', '(auth)', '(public)', 'other'],
  },
  {
    name: 'realtime (Socket.IO)',
    signature: /"io server disconnect"/,
    groups: ['(marketing)', '(public)', '(auth)', 'other'],
  },
  {
    name: 'authentication client (Better Auth)',
    signature: /better-auth:|better-auth\.message/,
    groups: ['(marketing)', '(public)', 'other'],
  },
  {
    name: 'query devtools',
    signature: /ReactQueryDevtools|tsqd-/,
    groups: ['(marketing)', '(public)', '(auth)', '(app)', '(admin)', 'other'],
  },
];

/**
 * Display names Radix gives the parts of its primitives, kept by the minifier: a part name
 * (`DialogContent`, `SwitchThumb`) is specific enough not to match the framework's own strings.
 */
const RADIX_PART =
  /"(Accordion|AlertDialog|Avatar|Checkbox|Collapsible|ContextMenu|Dialog|DropdownMenu|HoverCard|Menu|NavigationMenu|Popover|Popper|Progress|RadioGroup|RovingFocusGroup|ScrollArea|Select|Slider|Switch|Tabs|ToggleGroup|Toolbar|Tooltip)(Content|Item|List|Thumb|Indicator|Image|Viewport|Button)"|"(Slottable)"/g;

function manifests(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return manifests(path);
    return name === 'page_client-reference-manifest.js' ? [path] : [];
  });
}

/** Framework chunks loaded by every page (React, the Next.js runtime). */
const rootMainFiles = JSON.parse(
  readFileSync(join(buildDir, 'build-manifest.json'), 'utf8'),
).rootMainFiles;

function entryFiles(manifestPath) {
  const source = readFileSync(manifestPath, 'utf8');
  const json = source.slice(source.indexOf('= {') + 2).replace(/;\s*$/, '');
  const manifest = JSON.parse(json);
  return [...new Set([...rootMainFiles, ...Object.values(manifest.entryJSFiles).flat()])];
}

const contentCache = new Map();
function content(file) {
  if (!contentCache.has(file)) contentCache.set(file, readFileSync(join(buildDir, file)));
  return contentCache.get(file);
}

const sizeCache = new Map();
function compressedSize(file) {
  if (!sizeCache.has(file)) sizeCache.set(file, brotliCompressSync(content(file)).length);
  return sizeCache.get(file);
}

const failures = [];
for (const path of manifests(appDir)) {
  const page = relative(appDir, path).replace(/\/page_client-reference-manifest\.js$/, '');
  // Development tools (health page) answer 404 in production.
  if (page.includes('(dev)')) continue;
  const group = Object.keys(BUDGETS_KB).find((name) => page.includes(name)) ?? 'other';
  const files = entryFiles(path);
  const kilobytes = files.reduce((sum, file) => sum + compressedSize(file), 0) / 1024;
  const budget = BUDGETS_KB[group];
  const radix = new Set();
  for (const file of files) {
    for (const match of content(file).toString('utf8').matchAll(RADIX_PART)) {
      radix.add(match[1] ?? 'Slot');
    }
  }
  process.stdout.write(
    `${page}: ${kilobytes.toFixed(1)} kB (budget ${budget} kB, ${files.length} files)` +
      `; Radix: ${[...radix].sort().join(', ') || 'none'}\n`,
  );
  if (kilobytes > budget) failures.push(`${page}: ${kilobytes.toFixed(1)} kB > ${budget} kB`);
  for (const { name, signature, groups } of FORBIDDEN) {
    if (!groups.includes(group)) continue;
    const found = files.filter((file) => signature.test(content(file).toString('utf8')));
    if (found.length > 0) failures.push(`${page}: ${name} in ${found.join(', ')}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `Bundle budgets exceeded:\n${failures.map((line) => `- ${line}`).join('\n')}\n`,
  );
  process.exit(1);
}
process.stdout.write('Bundle budgets respected, no library outside the groups that use it.\n');
