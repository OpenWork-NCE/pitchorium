import { FakeOAuthProviders } from './fake-providers';

/**
 * The fake OIDC/OAuth providers as a service of their own, reachable from a browser, for the
 * journeys of the web app against the real api (`pnpm --filter @pitchorium/web test:e2e:live`).
 * Port: FAKE_OAUTH_PORT (3400 by default). A test announces the identity of the next consent
 * (`POST /__identity`), the browser is sent to `/<provider>/authorize`, which consents at once.
 */
async function main(): Promise<void> {
  const providers = new FakeOAuthProviders();
  await providers.start({
    port: Number(process.env['FAKE_OAUTH_PORT'] ?? 3400),
    inProcess: false,
  });
  process.stdout.write(`Fake OAuth providers on ${providers.url}\n`);
  const stop = () => void providers.stop().then(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

void main();
