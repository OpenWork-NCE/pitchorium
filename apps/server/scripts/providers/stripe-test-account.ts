import { STRIPE_V2_API_VERSION } from '../../src/modules/payments/infrastructure/stripe/stripe.provider';
import { CHECKOUT_ACCOUNT_MARKER_VALUE, PROVIDER_TEST_MARKER } from '../../test/providers/marker';

/**
 * pnpm providers:stripe-test-account: creates the onboarded connected account the Checkout test
 * of `pnpm test:providers` needs (STRIPE_TEST_CONNECTED_ACCOUNT), in test mode only.
 *
 *   (no argument)     checks STRIPE_TEST_CONNECTED_ACCOUNT if set, else creates an account
 *   --create          creates a new account and prints its onboarding link
 *   --link <acct_id>  prints a fresh onboarding link (a link is valid a few minutes)
 *   --check <acct_id> prints the state of the account
 */
const KEY = process.env['STRIPE_TEST_SECRET_KEY'] ?? '';
const BASE = 'https://api.stripe.com';
const RETURN_URL = 'https://example.com/pitchorium-stripe-test-account';

async function call(
  method: 'GET' | 'POST',
  path: string,
  body?: { json: unknown } | { form: Record<string, string> },
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { authorization: `Bearer ${KEY}` };
  let payload: string | undefined;
  if (body && 'json' in body) {
    headers['content-type'] = 'application/json';
    headers['stripe-version'] = STRIPE_V2_API_VERSION;
    payload = JSON.stringify(body.json);
  } else if (body) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(body.form).toString();
  }
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(payload === undefined ? {} : { body: payload }),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = json['error'] as { message?: string } | undefined;
    throw new Error(`Stripe ${method} ${path}: ${response.status} ${error?.message ?? ''}`);
  }
  return json;
}

/** Same configuration as the payments adapter (Accounts v2), plus the test marker. */
async function createAccount(): Promise<string> {
  const account = await call('POST', '/v2/core/accounts', {
    json: {
      identity: { country: 'fr' },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { requested: true },
            sepa_debit_payments: { requested: true },
          },
        },
      },
      defaults: { responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
      dashboard: 'full',
      metadata: { [PROVIDER_TEST_MARKER.key]: CHECKOUT_ACCOUNT_MARKER_VALUE },
    },
  });
  return String(account['id']);
}

async function onboardingLink(accountId: string): Promise<string> {
  const link = await call('POST', '/v1/account_links', {
    form: {
      account: accountId,
      type: 'account_onboarding',
      return_url: RETURN_URL,
      refresh_url: RETURN_URL,
    },
  });
  return String(link['url']);
}

async function check(accountId: string): Promise<boolean> {
  const account = await call('GET', `/v1/accounts/${accountId}`);
  const requirements = account['requirements'] as
    { currently_due?: string[]; disabled_reason?: string | null } | undefined;
  const ready = account['charges_enabled'] === true;
  process.stdout.write(
    [
      `Account ${accountId}`,
      `  details_submitted: ${String(account['details_submitted'])}`,
      `  charges_enabled:   ${String(account['charges_enabled'])}`,
      `  payouts_enabled:   ${String(account['payouts_enabled'])}`,
      `  disabled_reason:   ${requirements?.disabled_reason ?? 'none'}`,
      `  currently_due:     ${(requirements?.currently_due ?? []).join(', ') || 'none'}`,
      '',
      ready
        ? [
            'Ready: the account takes charges. Set it for the Checkout test:',
            `  apps/server/.env      STRIPE_TEST_CONNECTED_ACCOUNT=${accountId}`,
            `  GitHub secret         gh secret set STRIPE_TEST_CONNECTED_ACCOUNT --body ${accountId}`,
          ].join('\n')
        : `Not ready yet: finish the onboarding (pnpm providers:stripe-test-account --link ${accountId}).`,
      '',
    ].join('\n'),
  );
  return ready;
}

function instructions(accountId: string, url: string): string {
  return [
    `Connected account created: ${accountId}`,
    '',
    `Onboarding link (valid a few minutes; new one: --link ${accountId}):`,
    `  ${url}`,
    '',
    'Fill in the hosted onboarding with the test data of Stripe (docs.stripe.com/connect/testing):',
    '  - phone number: any valid French number, SMS code 000000',
    '  - business type: individual; website: https://accessible.stripe.com',
    '  - date of birth: 1901-01-01 (verified identity)',
    '  - address line 1: address_full_match, a real French postal code and city',
    '  - bank account (IBAN): FR1420041010050500013M02606',
    '  - identity document, if asked: the test image "success"',
    '',
    `Then check the state: pnpm providers:stripe-test-account --check ${accountId}`,
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  if (!KEY.startsWith('sk_test_')) {
    process.stderr.write('STRIPE_TEST_SECRET_KEY must be set to a test key (sk_test_...).\n');
    process.exit(1);
  }
  const [command, argument] = process.argv.slice(2);
  const existing = process.env['STRIPE_TEST_CONNECTED_ACCOUNT'] ?? '';
  if (command === '--check' && argument) {
    process.exit((await check(argument)) ? 0 : 2);
  }
  if (command === '--link' && argument) {
    process.stdout.write(instructions(argument, await onboardingLink(argument)));
    return;
  }
  if (command === undefined && existing) {
    process.exit((await check(existing)) ? 0 : 2);
  }
  if (command !== undefined && command !== '--create') {
    process.stderr.write('Usage: [--create | --link <acct_id> | --check <acct_id>]\n');
    process.exit(1);
  }
  const accountId = await createAccount();
  process.stdout.write(instructions(accountId, await onboardingLink(accountId)));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
