import { createDatabase } from '@pitchorium/db';
import { loadConfigOrExit, parseWorkerConfig } from '../src/platform/config/config';
import { FixedClock, SystemClock } from '../src/platform/kernel/clock';
import { S3ObjectStorage } from '../src/platform/storage/s3-object-storage';
import { seedDevContent } from './dev-seed/seed-dev-content';
import { DEMO_EMAIL_DOMAIN, DEMO_PASSWORD, seedDevData } from './dev-seed/seed-dev-data';
import { sampleSuggestions, seedDevDiscovery } from './dev-seed/seed-dev-discovery';
import { seedDevMessaging } from './dev-seed/seed-dev-messaging';
import { DEMO_EXTERNAL_INVITEE, seedDevNetwork } from './dev-seed/seed-dev-network';
import { createSeedContext, seedDevProjects } from './dev-seed/seed-dev-projects';
import { DEMO_MODERATORS, seedDevTrust } from './dev-seed/seed-dev-trust';

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
    const now = new Date();
    const result = await seedDevData({ db, storage, legal: config.legal, now });
    // New data goes through the application services and facades (ADR 0035).
    const clock = new FixedClock(now);
    const context = await createSeedContext(clock);
    let samples: string[] = [];
    const services = await (async () => {
      try {
        const projects = await seedDevProjects(context, clock, now);
        const messaging = await seedDevMessaging(context, clock, now);
        const discovery = await seedDevDiscovery(context, clock, now);
        samples = await sampleSuggestions(context);
        const trust = await seedDevTrust(context, clock, now);
        const network = await seedDevNetwork(context, clock, now);
        const content = await seedDevContent(context, clock, now);
        return { ...projects, ...messaging, ...discovery, ...trust, ...network, ...content };
      } finally {
        await context.close();
      }
    })();
    const inserted = Object.entries({ ...result, ...services })
      .map(([name, count]) => `${count} ${name}`)
      .join(', ');
    process.stdout.write(
      `Inserted: ${inserted}.\n` +
        `Demo accounts: <handle with dots>@${DEMO_EMAIL_DOMAIN} (for example ` +
        `aissatou.ba@${DEMO_EMAIL_DOMAIN}), password ${DEMO_PASSWORD}.\n` +
        'Images are processed by the worker (pnpm dev). Impact methodology: DEMO, not contractual.\n' +
        `Demo moderators (enable two-factor authentication first): ${DEMO_MODERATORS.join(', ')}.\n` +
        `Organisation invitation without an account: ${DEMO_EXTERNAL_INVITEE} (link in Mailpit).\n` +
        `Explained suggestions:\n${samples.map((line) => `- ${line}`).join('\n')}\n`,
    );
  } finally {
    storage.close();
    await pool.end();
  }
}

void main();
