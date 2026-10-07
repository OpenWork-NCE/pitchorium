import { createDatabase } from '@pitchorium/db';
import { loadConfigOrExit, parseWorkerConfig } from '../src/platform/config/config';
import { SystemClock } from '../src/platform/kernel/clock';
import { S3ObjectStorage } from '../src/platform/storage/s3-object-storage';
import { DEMO_EMAIL_DOMAIN, DEMO_PASSWORD, seedDevData } from './dev-seed/seed-dev-data';

/** pnpm db:seed:dev: demonstration data for the development of the web application. */
async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    process.stderr.write('db:seed:dev is refused when NODE_ENV=production.\n');
    process.exit(1);
  }
  const config = loadConfigOrExit(parseWorkerConfig);
  const { db, pool } = createDatabase({
    url: config.database.url,
    applicationName: 'pitchorium-seed-dev',
  });
  const storage = new S3ObjectStorage(config.storage, new SystemClock());
  try {
    const result = await seedDevData({ db, storage, legal: config.legal });
    const inserted = Object.entries(result)
      .map(([name, count]) => `${count} ${name}`)
      .join(', ');
    process.stdout.write(
      `Inserted: ${inserted}.\n` +
        `Demo accounts: <handle with dots>@${DEMO_EMAIL_DOMAIN} (for example ` +
        `aissatou.ba@${DEMO_EMAIL_DOMAIN}), password ${DEMO_PASSWORD}.\n` +
        'Images are processed by the worker (pnpm dev).\n',
    );
  } finally {
    storage.close();
    await pool.end();
  }
}

void main();
