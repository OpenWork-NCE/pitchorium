import { type ChildProcess, spawn } from 'node:child_process';
import { createWriteStream, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import startContainers from '../integration/global-setup';

declare module 'vitest' {
  export interface ProvidedContext {
    apiUrl: string;
    webOrigin: string;
  }
}

export const E2E_WEB_ORIGIN = 'http://web.pitchorium.test';
const ROOT = join(__dirname, '../..');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address ? resolve(address.port) : reject(new Error('port')),
      );
    });
  });
}

/** Configuration of the processes, as a deployment gives it (docs/operations/environments.md). */
function environment(values: Record<string, string>, apiUrl: string, healthPort: number) {
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: 'warn',
    DATABASE_URL: values['databaseUrl']!,
    REDIS_URL: values['redisUrl']!,
    QUEUE_PREFIX: 'e2e',
    S3_ENDPOINT: values['minioEndpoint']!,
    S3_FORCE_PATH_STYLE: 'true',
    S3_ACCESS_KEY_ID: 'pitchorium',
    S3_SECRET_ACCESS_KEY: 'pitchorium-secret',
    S3_BUCKET_PUBLIC: 'test-public',
    S3_BUCKET_PRIVATE: 'test-private',
    S3_PUBLIC_BASE_URL: `${values['minioEndpoint']}/test-public`,
    MAIL_TRANSPORT: 'smtp',
    MAIL_FROM: 'Pitchorium <e2e@pitchorium.invalid>',
    SMTP_URL: values['mailpitSmtpUrl']!,
    WEB_APP_URL: E2E_WEB_ORIGIN,
    API_PUBLIC_URL: apiUrl,
    API_HOST: '127.0.0.1',
    API_PORT: new URL(apiUrl).port,
    WORKER_HEALTH_PORT: String(healthPort),
    CORS_ORIGINS: E2E_WEB_ORIGIN,
    LEGAL_TERMS_VERSION: 'e2e-2026-10',
    LEGAL_PRIVACY_VERSION: 'e2e-2026-10',
    AUTH_SECRET: 'end-to-end-tests-secret-with-at-least-32-chars', // gitleaks:allow (test value)
    AUTH_PWNED_PASSWORD_CHECK: 'false',
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    LINKEDIN_CLIENT_ID: 'linkedin-client',
    LINKEDIN_CLIENT_SECRET: 'linkedin-secret',
    MICROSOFT_CLIENT_ID: 'microsoft-client',
    MICROSOFT_CLIENT_SECRET: 'microsoft-secret',
    PAYMENTS_MODE: 'simulated',
    // Scheduled tasks (erasures, reminders) every few seconds instead of their cron pattern.
    SCHEDULED_TASKS_EVERY_MS: '3000',
    // Test adapter of the antivirus (ADR 0126): the real ClamAV runs in the integration tests.
    MALWARE_SCANNER: 'eicar-only',
  };
}

function run(name: string, args: string[], env: NodeJS.ProcessEnv, logs: string): ChildProcess {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = createWriteStream(join(logs, `${name}.log`));
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  return child;
}

function exited(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) resolve(child.exitCode);
    else child.once('exit', (code) => resolve(code));
  });
}

async function waitHealthy(url: string, child: ChildProcess, name: string): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${name} exited with ${child.exitCode}`);
    const ok = await fetch(url)
      .then((response) => response.ok)
      .catch(() => false);
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${name} not ready at ${url}`);
}

/**
 * Containers of the integration suite, demonstration data (pnpm db:seed:dev), then the built
 * api and worker (pnpm build first); their logs are kept in a temporary directory.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const values: Record<string, string> = {};
  const stopContainers = await startContainers({
    provide: (key: string, value: string) => {
      values[key] = value;
      project.provide(key as never, value as never);
    },
  } as unknown as TestProject);
  const apiUrl = `http://127.0.0.1:${await freePort()}`;
  const healthPort = await freePort();
  const env = { ...process.env, ...environment(values, apiUrl, healthPort) };
  const logs = mkdtempSync(join(tmpdir(), 'pitchorium-e2e-'));
  process.stdout.write(`End-to-end logs: ${logs}\n`);

  const seed = run('seed', ['-r', '@swc-node/register', 'scripts/seed-dev.ts'], env, logs);
  if ((await exited(seed)) !== 0) throw new Error(`Seed failed, see ${logs}/seed.log`);
  const api = run('api', ['dist/main.api.js'], env, logs);
  const worker = run('worker', ['dist/main.worker.js'], env, logs);
  await waitHealthy(`${apiUrl}/v1/health/ready`, api, 'api');
  await waitHealthy(`http://127.0.0.1:${healthPort}/health/ready`, worker, 'worker');
  project.provide('apiUrl', apiUrl);
  project.provide('webOrigin', E2E_WEB_ORIGIN);

  return async () => {
    for (const child of [api, worker]) child.kill('SIGTERM');
    await Promise.all([exited(api), exited(worker)]);
    await stopContainers();
  };
}
