// Runs the provider sandbox suite (test/providers) when test keys are present, and stops
// cleanly otherwise. Live keys are refused: the suite creates and deletes objects.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const stripe = process.env.STRIPE_TEST_SECRET_KEY ?? '';
const flutterwave = process.env.FLUTTERWAVE_TEST_SECRET_KEY ?? '';

if (stripe && !stripe.startsWith('sk_test_')) {
  process.stderr.write(
    'test:providers: STRIPE_TEST_SECRET_KEY must be a test key (sk_test_...).\n',
  );
  process.exit(1);
}
if (flutterwave && !flutterwave.startsWith('FLWSECK_TEST')) {
  process.stderr.write(
    'test:providers: FLUTTERWAVE_TEST_SECRET_KEY must be a test key (FLWSECK_TEST...).\n',
  );
  process.exit(1);
}
if (!stripe && !flutterwave) {
  process.stdout.write(
    'test:providers: neither STRIPE_TEST_SECRET_KEY nor FLUTTERWAVE_TEST_SECRET_KEY is set; ' +
      'the provider sandbox suite is skipped.\n',
  );
  process.exit(0);
}
process.stdout.write(
  `test:providers: Stripe ${stripe ? 'enabled' : 'skipped (no key)'}, ` +
    `Flutterwave ${flutterwave ? 'enabled' : 'skipped (no key)'}.\n`,
);
const vitest = join(
  dirname(createRequire(import.meta.url).resolve('vitest/package.json')),
  'vitest.mjs',
);
const result = spawnSync(process.execPath, [vitest, 'run', '-c', 'vitest.providers.config.mts'], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
