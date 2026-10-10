#!/usr/bin/env node
// Initial JavaScript per route group, compressed (Brotli), from the client reference manifests of
// a production build (ADR 0090, ADR 0094): fails above the budget of a group, or when a library a
// group must not carry reaches its first load (GSAP outside the editorial pages; realtime, the
// authentication client or the query devtools on the editorial and public pages; the editor of
// the composer and the viewer of the images anywhere, PROMPT FRONT 4). Lists the Radix
// primitives of each page: only the ones its components use may appear.
//
//
// With --views, the build of the end-to-end tests (.next-e2e, built with the variables of
// e2e/support/serve.mjs) is also served with the stub api, and each public page of a resource is
// read as a visitor and as a member: the JavaScript its HTML loads (scripts and script preloads,
// the member shell included, which is loaded on demand) is measured for each view, against its
// own budget (VIEW_BUDGETS_KB).
//
// Usage: node scripts/check-bundles.mjs [build directory, default .next] [--views]
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { assertPortFree } from '../e2e/support/ports.mjs';

const args = process.argv.slice(2);
const views = args.includes('--views');
const buildDir = args.find((arg) => !arg.startsWith('--')) ?? '.next';
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
  // as in (app): the first load of the group, member parts included; a visitor's view, without
  // them, has its own budget (VIEW_BUDGETS_KB, --views).
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
    // The editor of the composer (Tiptap, ProseMirror) loads when the composer opens (ADR 0119).
    name: 'editor (Tiptap, ProseMirror)',
    signature: /ProseMirror-/,
    groups: ['(marketing)', '(public)', '(auth)', '(app)', '(admin)', 'other'],
  },
  {
    // The viewer of the images (Embla) loads when an image is opened.
    name: 'image viewer (Embla)',
    signature: /slidesToScroll/,
    groups: ['(marketing)', '(public)', '(auth)', '(app)', '(admin)', 'other'],
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

/**
 * Views of a public page of a resource (ADR 0101): a visitor gets the public shell only, a
 * member the shell of the member space, loaded on demand (lazy-member-shell.tsx).
 */
const VIEW_BUDGETS_KB = { visitor: 190, member: 250 };

/** Pages of the stub api read in both views (e2e/support/stub-api.mjs). */
const VIEW_PAGES = [
  '/fr/members/aissatou-ba',
  '/fr/members/aissatou-ba/network',
  '/fr/organizations/fondation-teranga',
  '/fr/projects',
  '/fr/projects/ferme-solaire-thies',
  // A public publication of e2e/support/stub-content.mjs (five images).
  '/fr/posts/0192f4a0-2000-7000-8000-000000000004',
];
const MEMBER = 'kofi.mensah@demo.pitchorium.test';

/**
 * Pages of the team of a project, read by a member of it only: the heaviest step of the
 * assistant (its step loaded with the page, ADR 0131), its preview and the management.
 */
const TEAM_PAGES = [
  '/fr/projects/projet-en-preparation/edit/essentials',
  '/fr/projects/projet-en-preparation/edit/preview',
  '/fr/projects/ferme-solaire-thies/manage',
];
const TEAM_MEMBER = 'aissatou.ba@demo.pitchorium.test';
const ORIGIN = 'http://localhost:3201';

/**
 * Scripts the HTML loads: `<script src>` and `<link rel="preload" as="script">`, except the
 * `noModule` polyfills, which no browser that runs modules downloads.
 */
function scriptsOf(html) {
  const files = new Set();
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
    const isScript = tag.startsWith('<script');
    if (isScript && /\bnoModule\b/i.test(tag)) continue;
    if (!isScript && !(/rel="preload"/.test(tag) && /as="script"/.test(tag))) continue;
    const url = /(?:src|href)="([^"]+)"/.exec(tag)?.[1];
    if (url?.startsWith('/_next/')) files.add(url.slice('/_next/'.length).split('?')[0]);
  }
  return [...files];
}

async function measureViews() {
  await Promise.all([assertPortFree(3201), assertPortFree(3299)]);
  const server = spawn('node', ['e2e/support/serve.mjs'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, NEXT_DIST_DIR: buildDir },
  });
  try {
    for (let attempt = 0; ; attempt += 1) {
      const ready = await fetch(`${ORIGIN}/fr`).then(
        (response) => response.ok,
        () => false,
      );
      if (ready) break;
      if (attempt > 120) throw new Error('The server of the views did not start');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const reads = [
      ...VIEW_PAGES.flatMap((page) => [
        { page, view: 'visitor', account: null },
        { page, view: 'member', account: MEMBER },
      ]),
      ...TEAM_PAGES.map((page) => ({ page, view: 'member', account: TEAM_MEMBER })),
    ];
    for (const { page, view, account } of reads) {
      const headers = account
        ? { cookie: `pitchorium.session_token=${encodeURIComponent(account)}` }
        : {};
      const response = await fetch(`${ORIGIN}${page}`, { headers });
      if (!response.ok) {
        failures.push(`${page} (${view}): HTTP ${response.status}`);
        continue;
      }
      const files = scriptsOf(await response.text());
      const kilobytes = files.reduce((sum, file) => sum + compressedSize(file), 0) / 1024;
      const budget = VIEW_BUDGETS_KB[view];
      process.stdout.write(
        `${page} as a ${view}: ${kilobytes.toFixed(1)} kB (budget ${budget} kB, ${files.length} files)\n`,
      );
      if (kilobytes > budget) {
        failures.push(`${page} as a ${view}: ${kilobytes.toFixed(1)} kB > ${budget} kB`);
      }
    }
  } finally {
    server.kill('SIGTERM');
  }
}

if (views) await measureViews();

if (failures.length > 0) {
  process.stderr.write(
    `Bundle budgets exceeded:\n${failures.map((line) => `- ${line}`).join('\n')}\n`,
  );
  process.exit(1);
}
process.stdout.write('Bundle budgets respected, no library outside the groups that use it.\n');
