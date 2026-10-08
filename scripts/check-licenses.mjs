#!/usr/bin/env node
// Refuses a production dependency under a strong copyleft licence (GPL, AGPL), whose terms
// would reach the server as distributed in its image; LGPL and MPL stay allowed. Usage:
// pnpm check:licenses (CI). The full list is printed for the record.
import { execFileSync } from 'node:child_process';

const output = execFileSync('pnpm', ['-r', 'licenses', 'list', '--prod', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const byLicense = JSON.parse(output);
const copyleft = /(^|[^L])A?GPL/i;
// A choice of licences (`MIT OR GPL-2.0`) is fine when one alternative is not copyleft.
const refused = (license) =>
  license
    .replace(/[()]/g, '')
    .split(/\s+OR\s+/i)
    .every((alternative) => copyleft.test(alternative));
const failures = [];
for (const [license, packages] of Object.entries(byLicense)) {
  process.stdout.write(`${license}: ${packages.length}\n`);
  if (refused(license)) {
    for (const item of packages)
      failures.push(`${item.name}@${item.versions.join(',')} (${license})`);
  }
}
if (failures.length > 0) {
  process.stderr.write(`Refused licences:\n${failures.map((line) => `- ${line}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('No GPL or AGPL production dependency.\n');
