// Serves the end-to-end build (.next-e2e) with the stub api, for Lighthouse CI. Same ports and
// variables as playwright.config.ts. Build first: scripts/lighthouse.sh does both. Stops only the
// two children it started.
import { spawn } from 'node:child_process';
import { E2E_ENV } from './e2e-env.mjs';
import { assertPortFree } from './ports.mjs';

try {
  await Promise.all([assertPortFree(3201), assertPortFree(3299)]);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

const env = { ...process.env, ...E2E_ENV };
const children = [
  spawn('node', ['e2e/support/stub-api.mjs'], { env, stdio: 'inherit' }),
  spawn('./node_modules/.bin/next', ['start', '--port', '3201'], { env, stdio: 'inherit' }),
];
const stop = () => {
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
