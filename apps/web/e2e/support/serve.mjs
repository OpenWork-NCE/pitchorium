// Serves the end-to-end build (.next-e2e) with the stub api, for Lighthouse CI. Same ports and
// variables as playwright.config.ts. Build first: scripts/lighthouse.sh does both. Stops only the
// two children it started.
import { spawn } from 'node:child_process';
import { assertPortFree } from './ports.mjs';

export const E2E_ENV = {
  NEXT_DIST_DIR: '.next-e2e',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3201',
  NEXT_PUBLIC_API_URL: 'http://localhost:3299',
  NEXT_PUBLIC_CDN_URL: 'http://localhost:3299/files',
  NEXT_PUBLIC_VERCEL_ANALYTICS: 'false',
  NEXT_PUBLIC_SENTRY_DSN: '',
};

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
