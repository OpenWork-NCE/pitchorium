#!/usr/bin/env node
// Initial JavaScript per route group, compressed (Brotli), from the client reference manifests of
// a production build (ADR 0090): fails above the budget of a group, or when GSAP reaches a chunk
// of the member space, the administration, the authentication or the public pages.
//
// Usage: node scripts/check-bundles.mjs [build directory, default .next]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

const buildDir = process.argv[2] ?? '.next';
const appDir = join(buildDir, 'server/app');

/**
 * Kilobytes of Brotli-compressed initial JavaScript per page of each group, framework included
 * (React and the Next.js runtime weigh about 111 kB): docs/architecture/frontend.md.
 */
const BUDGETS_KB = {
  '(marketing)': 240,
  '(public)': 260,
  '(auth)': 260,
  '(app)': 300,
  '(admin)': 300,
  other: 260,
};

/** Groups that must never load GSAP (public editorial pages only, ADR 0086). */
const WITHOUT_GSAP = ['(app)', '(admin)', '(auth)', '(public)'];
const GSAP_SIGNATURE = /GreenSock|gsap\.registerPlugin|_gsScope/;

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

const sizeCache = new Map();
function compressedSize(file) {
  if (!sizeCache.has(file)) {
    sizeCache.set(file, brotliCompressSync(readFileSync(join(buildDir, file))).length);
  }
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
  process.stdout.write(
    `${page}: ${kilobytes.toFixed(1)} kB (budget ${budget} kB, ${files.length} files)\n`,
  );
  if (kilobytes > budget) failures.push(`${page}: ${kilobytes.toFixed(1)} kB > ${budget} kB`);
  if (WITHOUT_GSAP.includes(group)) {
    const withGsap = files.filter((file) =>
      GSAP_SIGNATURE.test(readFileSync(join(buildDir, file), 'utf8')),
    );
    if (withGsap.length > 0) failures.push(`${page}: GSAP in ${withGsap.join(', ')}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `Bundle budgets exceeded:\n${failures.map((line) => `- ${line}`).join('\n')}\n`,
  );
  process.exit(1);
}
process.stdout.write('Bundle budgets respected, no GSAP outside the editorial pages.\n');
