import { STRIPE_V2_API_VERSION } from '../../src/modules/payments/infrastructure/stripe/stripe.provider';
import { PROVIDER_TEST_MARKER } from '../../test/providers/marker';

/**
 * pnpm providers:cleanup: closes the Stripe connected accounts, deletes the Stripe webhook
 * endpoints and the Flutterwave subaccounts that the provider tests created, recognized by
 * PROVIDER_TEST_MARKER only. Test keys only.
 */
const STRIPE_KEY = process.env['STRIPE_TEST_SECRET_KEY'] ?? '';
const FLUTTERWAVE_KEY = process.env['FLUTTERWAVE_TEST_SECRET_KEY'] ?? '';
type Json = Record<string, unknown>;

async function call(url: string, init: RequestInit): Promise<{ status: number; body: Json }> {
  const response = await fetch(url, init);
  return { status: response.status, body: (await response.json()) as Json };
}

function marked(metadata: unknown): boolean {
  return (metadata as Json | null)?.[PROVIDER_TEST_MARKER.key] === PROVIDER_TEST_MARKER.value;
}

async function cleanStripe(): Promise<string[]> {
  const done: string[] = [];
  const v2 = {
    authorization: `Bearer ${STRIPE_KEY}`,
    'stripe-version': STRIPE_V2_API_VERSION,
    'content-type': 'application/json',
  };
  // Open accounts only (the list leaves closed ones out unless asked).
  let next: string | null = '/v2/core/accounts?limit=20';
  while (next) {
    const page = await call(`https://api.stripe.com${next}`, { headers: v2 });
    if (page.status >= 400) throw new Error(`Stripe accounts: ${JSON.stringify(page.body)}`);
    for (const account of (page.body['data'] as Json[] | undefined) ?? []) {
      if (!marked(account['metadata']) || account['closed'] === true) continue;
      const closed = await call(
        `https://api.stripe.com/v2/core/accounts/${String(account['id'])}/close`,
        {
          method: 'POST',
          headers: v2,
          body: JSON.stringify({ applied_configurations: account['applied_configurations'] ?? [] }),
        },
      );
      if (closed.status >= 400) throw new Error(`Stripe close: ${JSON.stringify(closed.body)}`);
      done.push(`Stripe account ${String(account['id'])} closed`);
    }
    next = (page.body['next_page_url'] as string | null | undefined) ?? null;
  }
  const v1 = { authorization: `Bearer ${STRIPE_KEY}` };
  const endpoints = await call('https://api.stripe.com/v1/webhook_endpoints?limit=100', {
    headers: v1,
  });
  for (const endpoint of (endpoints.body['data'] as Json[] | undefined) ?? []) {
    if (!marked(endpoint['metadata'])) continue;
    await call(`https://api.stripe.com/v1/webhook_endpoints/${String(endpoint['id'])}`, {
      method: 'DELETE',
      headers: v1,
    });
    done.push(`Stripe webhook endpoint ${String(endpoint['id'])} deleted`);
  }
  return done;
}

async function cleanFlutterwave(): Promise<string[]> {
  const done: string[] = [];
  const headers = { authorization: `Bearer ${FLUTTERWAVE_KEY}` };
  const found: string[] = [];
  for (let page = 1; ; page += 1) {
    // No subaccount at all answers 400 « Subaccounts not found ».
    const listed = await call(`https://api.flutterwave.com/v3/subaccounts?page=${page}`, {
      headers,
    });
    const items = (listed.body['data'] as Json[] | null | undefined) ?? [];
    for (const item of items) {
      const meta =
        (item['meta'] as { meta_name?: string; meta_value?: string }[] | undefined) ?? [];
      if (
        meta.some(
          (entry) =>
            entry.meta_name === PROVIDER_TEST_MARKER.key &&
            entry.meta_value === PROVIDER_TEST_MARKER.value,
        )
      ) {
        found.push(String(item['id']));
      }
    }
    const info = (listed.body['meta'] as { page_info?: { total_pages?: number } } | undefined)
      ?.page_info;
    if (items.length === 0 || page >= (info?.total_pages ?? 1)) break;
  }
  for (const id of found) {
    const deleted = await call(`https://api.flutterwave.com/v3/subaccounts/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (deleted.status >= 400)
      throw new Error(`Flutterwave delete: ${JSON.stringify(deleted.body)}`);
    done.push(`Flutterwave subaccount ${id} deleted`);
  }
  return done;
}

async function main(): Promise<void> {
  if (STRIPE_KEY && !STRIPE_KEY.startsWith('sk_test_'))
    throw new Error('STRIPE_TEST_SECRET_KEY must be a test key.');
  if (FLUTTERWAVE_KEY && !FLUTTERWAVE_KEY.startsWith('FLWSECK_TEST')) {
    throw new Error('FLUTTERWAVE_TEST_SECRET_KEY must be a test key.');
  }
  const done = [
    ...(STRIPE_KEY ? await cleanStripe() : ['Stripe skipped (no STRIPE_TEST_SECRET_KEY)']),
    ...(FLUTTERWAVE_KEY
      ? await cleanFlutterwave()
      : ['Flutterwave skipped (no FLUTTERWAVE_TEST_SECRET_KEY)']),
  ];
  process.stdout.write(`${done.length > 0 ? done.join('\n') : 'Nothing to clean.'}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
