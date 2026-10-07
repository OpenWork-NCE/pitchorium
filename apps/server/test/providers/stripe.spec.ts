import { v7 as uuid } from 'uuid';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { Money } from '../../src/platform/kernel';
import {
  StripeProvider,
  stripeSignature,
} from '../../src/modules/payments/infrastructure/stripe/stripe.provider';
import {
  type ExactJson,
  field,
  list,
  text,
} from '../../src/modules/payments/infrastructure/provider-http';
import { contributionRecord, expectShape, raw } from './support';

const KEY = process.env.STRIPE_TEST_SECRET_KEY ?? '';
/** An onboarded test account able to take charges; the platform account is used without it. */
const CONNECTED = process.env.STRIPE_TEST_CONNECTED_ACCOUNT ?? '';
const BASE = 'https://api.stripe.com';

async function stripe(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, string> = {},
  account = '',
): Promise<ExactJson> {
  const form = new URLSearchParams(params).toString();
  const headers: Record<string, string> = { authorization: `Bearer ${KEY}` };
  if (account) headers['stripe-account'] = account;
  const response =
    method === 'GET'
      ? await raw('stripe', `${BASE}${path}${form ? `?${form}` : ''}`, { method, headers })
      : await raw('stripe', `${BASE}${path}`, {
          method,
          headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
          body: form,
        });
  expect(response.status, JSON.stringify(response.body)).toBeLessThan(400);
  return response.body;
}

/** A payment confirmed with a test card (Checkout itself needs a browser). */
async function pay(paymentMethod: string, contributionId: string): Promise<ExactJson> {
  return stripe(
    'POST',
    '/v1/payment_intents',
    {
      amount: '2000',
      currency: 'eur',
      confirm: 'true',
      payment_method: paymentMethod,
      'payment_method_types[0]': 'card',
      'metadata[contribution_id]': contributionId,
      ...(CONNECTED ? { application_fee_amount: '100' } : {}),
    },
    CONNECTED,
  );
}

/**
 * Exact shape of the Stripe answers the adapter reads (docs.stripe.com/api), against the test
 * mode of the account behind STRIPE_TEST_SECRET_KEY.
 */
describe.skipIf(!KEY)('Stripe sandbox', () => {
  const adapter = new StripeProvider({ secretKey: KEY, webhookSecret: 'unused', apiBaseUrl: BASE });
  const cleanup: (() => Promise<unknown>)[] = [];

  afterAll(async () => {
    for (const step of cleanup.reverse()) await step().catch(() => undefined);
  });

  it('creates a connected account, its onboarding link and reads its state', async () => {
    const account = await adapter.createAccount({
      userId: uuid(),
      country: 'FR',
      currency: 'EUR',
      email: `provider-test+${Date.now()}@example.com`,
      name: 'Pitchorium provider test',
      bankAccount: undefined,
      commissionRateBps: 500,
    });
    cleanup.push(() => stripe('DELETE', `/v1/accounts/${account.providerAccountId}`));
    expect(account.providerAccountId).toMatch(/^acct_/);
    expect(account.state.status).toBe('pending');
    const body = await stripe('GET', `/v1/accounts/${account.providerAccountId}`);
    expectShape(
      body,
      {
        id: 'string',
        charges_enabled: 'boolean',
        payouts_enabled: 'boolean',
        details_submitted: 'boolean',
        requirements: 'object',
      },
      'account',
    );
    expect(
      await adapter.onboardingLink(account.providerAccountId, 'https://example.com/back'),
    ).toMatch(/^https:\/\/connect\.stripe\.com\//);
    expect((await adapter.accountState(account.providerAccountId)).status).toBe('pending');
  });

  it.skipIf(!CONNECTED)('opens a Checkout session and reads it back as pending', async () => {
    const contribution = contributionRecord({
      provider: 'stripe',
      currency: 'EUR',
      providerAccountId: CONNECTED,
    });
    const session = await adapter.createSession({
      contributionId: contribution.id,
      providerAccountId: CONNECTED,
      amount: Money.of(2500n, 'EUR'),
      commission: Money.of(125n, 'EUR'),
      method: 'card',
      expiresAt: new Date(Date.now() + 3_600_000),
      contributorEmail: 'contributor@example.com',
      contributorName: 'Provider test',
      description: 'Pitchorium provider test',
      locale: 'fr',
      returnUrl: 'https://example.com/back',
    });
    cleanup.push(() =>
      stripe('POST', `/v1/checkout/sessions/${session.sessionId}/expire`, {}, CONNECTED),
    );
    expect(session.paymentUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const snapshot = await adapter.retrieve({
      ...contribution,
      providerSessionId: session.sessionId,
    });
    expect(snapshot).toMatchObject({
      status: 'pending',
      reference: contribution.id,
      amount: Money.of(2500n, 'EUR'),
    });
  });

  it('pays, lists and refunds a charge with the fields the adapter reads', async () => {
    const contributionId = uuid();
    const intent = await pay('pm_card_visa', contributionId);
    const paymentId = text(field(intent, 'id')) ?? '';
    expect(text(field(intent, 'status'))).toBe('succeeded');
    const expanded = await stripe(
      'GET',
      `/v1/payment_intents/${paymentId}`,
      {
        'expand[0]': 'latest_charge.balance_transaction',
        'expand[1]': 'latest_charge.refunds',
      },
      CONNECTED,
    );
    expectShape(
      expanded,
      {
        id: 'string',
        status: 'string',
        'latest_charge.disputed': 'boolean',
        'latest_charge.refunds.data': 'array',
        'latest_charge.balance_transaction.fee_details': 'array',
      },
      'payment intent',
    );
    for (const detail of list(
      field(expanded, 'latest_charge', 'balance_transaction', 'fee_details'),
    )) {
      expectShape(detail, { type: 'string', amount: 'number' }, 'fee detail');
    }

    const from = new Date(Date.now() - 600_000);
    const listed = await adapter.listTransactions([CONNECTED], from, new Date(Date.now() + 60_000));
    expect(listed.find((item) => item.providerPaymentId === paymentId)).toMatchObject({
      reference: contributionId,
      status: 'succeeded',
      amount: Money.of(2000n, 'EUR'),
      refunded: Money.of(0n, 'EUR'),
    });

    const refunded = await adapter.refund({
      contribution: {
        id: contributionId,
        providerAccountId: CONNECTED,
        providerSessionId: null,
        providerPaymentId: paymentId,
        currency: 'EUR',
      },
      refundId: uuid(),
      amount: Money.of(500n, 'EUR'),
    });
    expect(refunded.providerRefundId).toMatch(/^re_/);
    expect(['pending', 'succeeded']).toContain(refunded.status);
    const refreshed = await adapter.refreshRefund(
      contributionRecord({ provider: 'stripe', currency: 'EUR', providerAccountId: CONNECTED }),
      refunded.providerRefundId,
    );
    expect(['pending', 'succeeded']).toContain(refreshed.status);
  });

  it('reports a dispute with the fields the adapter reads', async () => {
    const intent = await pay('pm_card_createDispute', uuid());
    const paymentId = text(field(intent, 'id')) ?? '';
    // The test card opens the dispute asynchronously.
    const dispute = await vi.waitFor(
      async () => {
        const listed = await stripe(
          'GET',
          '/v1/disputes',
          { payment_intent: paymentId, limit: '100' },
          CONNECTED,
        );
        const first = list(field(listed, 'data'))[0];
        expect(first).toBeDefined();
        return first;
      },
      { timeout: 60_000, interval: 2000 },
    );
    expectShape(dispute, { id: 'string', amount: 'number', status: 'string' }, 'dispute');
    const charge = await stripe(
      'GET',
      `/v1/payment_intents/${paymentId}`,
      { 'expand[0]': 'latest_charge' },
      CONNECTED,
    );
    expect(field(charge, 'latest_charge', 'disputed')).toBe(true);
  });

  it('verifies a notification signed with the secret of a sandbox endpoint', async () => {
    const endpoint = await stripe('POST', '/v1/webhook_endpoints', {
      url: 'https://example.com/pitchorium-provider-test',
      'enabled_events[0]': 'checkout.session.completed',
      connect: 'true',
    });
    cleanup.push(() => stripe('DELETE', `/v1/webhook_endpoints/${text(field(endpoint, 'id'))}`));
    const secret = text(field(endpoint, 'secret')) ?? '';
    expect(secret).toMatch(/^whsec_/);
    const signed = new StripeProvider({ secretKey: KEY, webhookSecret: secret, apiBaseUrl: BASE });
    const body = JSON.stringify({
      id: 'evt_provider_test',
      type: 'checkout.session.completed',
      account: 'acct_provider_test',
      data: { object: { client_reference_id: uuid(), payment_intent: 'pi_provider_test' } },
    });
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const header = `t=${timestamp},v1=${stripeSignature(secret, timestamp, body)}`;
    expect(
      signed.verifyWebhook({ 'stripe-signature': header }, Buffer.from(body), now),
    ).toMatchObject({ externalId: 'evt_provider_test', providerPaymentId: 'pi_provider_test' });
    expect(() =>
      adapter.verifyWebhook({ 'stripe-signature': header }, Buffer.from(body), now),
    ).toThrow(/signature mismatch/);
  });
});
