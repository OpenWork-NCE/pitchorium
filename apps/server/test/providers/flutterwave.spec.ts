import { v7 as uuid } from 'uuid';
import { afterAll, describe, expect, it } from 'vitest';
import { Money } from '../../src/platform/kernel';
import {
  FlutterwaveFxRateProvider,
  FlutterwaveProvider,
} from '../../src/modules/payments/infrastructure/flutterwave/flutterwave.provider';
import {
  type ExactJson,
  field,
  list,
  text,
} from '../../src/modules/payments/infrastructure/provider-http';
import { PROVIDER_TEST_MARKER } from './marker';
import { contributionRecord, expectShape, raw } from './support';

const KEY = process.env.FLUTTERWAVE_TEST_SECRET_KEY ?? '';
const BASE = 'https://api.flutterwave.com';
/** Test bank account of the Flutterwave documentation (Access Bank). */
const TEST_BANK = { bankCode: '044', accountNumber: '0690000031' };

async function flutterwave(method: 'GET' | 'DELETE', path: string): Promise<ExactJson> {
  const response = await raw('flutterwave', `${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${KEY}` },
  });
  expect(response.status, JSON.stringify(response.body)).toBeLessThan(400);
  expect(text(field(response.body, 'status'))).toBe('success');
  return response.body;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Exact shape of the Flutterwave v3 answers the adapter reads (developer.flutterwave.com),
 * against the test mode of the account behind FLUTTERWAVE_TEST_SECRET_KEY.
 */
describe.skipIf(!KEY)('Flutterwave sandbox', () => {
  const adapter = new FlutterwaveProvider({
    secretKey: KEY,
    webhookSecretHash: 'provider-test-hash',
    apiBaseUrl: BASE,
  });
  const email = `provider-test+${Date.now()}@example.com`;
  const cleanup: (() => Promise<unknown>)[] = [];

  afterAll(async () => {
    for (const step of cleanup.reverse()) await step().catch(() => undefined);
  });

  /** Subaccounts of the test bank account; the list does not return `business_email`. */
  async function deleteSubaccounts(match: (item: ExactJson) => boolean): Promise<void> {
    // No subaccount at all answers 400 « Subaccounts not found ».
    const listed = await raw(
      'flutterwave',
      `${BASE}/v3/subaccounts?account_number=${TEST_BANK.accountNumber}`,
      { method: 'GET', headers: { authorization: `Bearer ${KEY}` } },
    );
    for (const item of list(field(listed.body, 'data'))) {
      if (text(field(item, 'account_number')) === TEST_BANK.accountNumber && match(item)) {
        await flutterwave('DELETE', `/v3/subaccounts/${text(field(item, 'id'))}`);
      }
    }
  }

  it('creates a subaccount and a Standard payment link split with it', async () => {
    // One subaccount per bank account: a run interrupted before its cleanup left one.
    await deleteSubaccounts(() => true);
    const account = await adapter.createAccount({
      userId: uuid(),
      country: 'NG',
      currency: 'NGN',
      email,
      name: 'Pitchorium provider test',
      bankAccount: { ...TEST_BANK, accountName: 'Pitchorium provider test' },
      commissionRateBps: 500,
      metadata: { [PROVIDER_TEST_MARKER.key]: PROVIDER_TEST_MARKER.value },
    });
    cleanup.push(() =>
      deleteSubaccounts((item) => text(field(item, 'subaccount_id')) === account.providerAccountId),
    );
    expect(account.providerAccountId).toMatch(/^RS_/);
    const session = await adapter.createSession({
      contributionId: uuid(),
      providerAccountId: account.providerAccountId,
      amount: Money.of(500_000n, 'NGN'),
      commission: Money.of(25_000n, 'NGN'),
      method: 'card',
      expiresAt: new Date(Date.now() + 3_600_000),
      contributorEmail: 'contributor@example.com',
      contributorName: 'Provider test',
      description: 'Pitchorium provider test',
      locale: 'en',
      returnUrl: 'https://example.com/back',
    });
    expect(session.paymentUrl).toMatch(/^https:\/\//);
  });

  it('lists and verifies transactions with the fields the adapter reads', async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86_400_000);
    const page = await flutterwave(
      'GET',
      `/v3/transactions?from=${day(from)}&to=${day(to)}&page=1`,
    );
    expectShape(page, { data: 'array', 'meta.page_info.total_pages': 'number' }, 'transactions');
    const listed = await adapter.listTransactions([], from, to);
    const first = list(field(page, 'data'))[0];
    if (!first) return; // An empty sandbox has no transaction to verify.
    expectShape(
      first,
      {
        id: 'number',
        tx_ref: 'string',
        amount: 'number',
        currency: 'string',
        status: 'string',
        created_at: 'string',
      },
      'transaction',
    );
    const id = text(field(first, 'id')) ?? '';
    expect(listed.some((item) => item.providerPaymentId === id)).toBe(true);
    const verified = await flutterwave('GET', `/v3/transactions/${id}/verify`);
    expectShape(
      field(verified, 'data'),
      {
        id: 'number',
        tx_ref: 'string',
        flw_ref: 'string',
        amount: 'number',
        currency: 'string',
        status: 'string',
        app_fee: 'nullable',
      },
      'verification',
    );
    const snapshot = await adapter.retrieve(
      contributionRecord({
        provider: 'flutterwave',
        currency: text(field(first, 'currency')) ?? 'NGN',
        providerPaymentId: id,
      }),
    );
    expect(snapshot.paymentId).toBe(id);
    expect(snapshot.reference).toBe(text(field(first, 'tx_ref')));
  });

  it('lists the chargebacks and the refunds with the fields the adapter reads', async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 90 * 86_400_000);
    const chargebacks = await flutterwave(
      'GET',
      `/v3/chargebacks?from=${day(from)}&to=${day(to)}&page=1`,
    );
    expectShape(
      chargebacks,
      { data: 'array', 'meta.page_info.total_pages': 'number' },
      'chargebacks',
    );
    for (const item of list(field(chargebacks, 'data'))) {
      expectShape(
        item,
        {
          id: 'number',
          amount: 'number',
          flw_ref: 'string',
          status: 'string',
          transaction_id: 'number',
          tx_ref: 'string',
        },
        'chargeback',
      );
    }
    expect(Array.isArray(await adapter.disputedPayments(from, to))).toBe(true);
    const refunds = await flutterwave('GET', `/v3/refunds?from=${day(from)}&to=${day(to)}`);
    for (const item of list(field(refunds, 'data'))) {
      expectShape(item, { id: 'number', status: 'string' }, 'refund');
    }
  });

  it('reads the indicative rate of a currency against the euro', async (context) => {
    const provider = new FlutterwaveFxRateProvider({
      secretKey: KEY,
      webhookSecretHash: 'unused',
      apiBaseUrl: BASE,
    });
    try {
      const rate = await provider.rate('NGN', new Date());
      expect(rate.unitsPerEur).toMatch(/^\d+(\.\d+)?$/);
    } catch (error) {
      // The sandbox answers this error for every key since 2026-10-08 (ADR 0054): reported as
      // a skip with its reason, never as a pass.
      if (String(error).includes('Please contact support')) {
        context.skip(`Flutterwave sandbox outage: ${String(error)}`);
      }
      throw error;
    }
  });

  it('accepts a documented notification carrying the secret hash, and only with it', () => {
    const body = JSON.stringify({
      event: 'charge.completed',
      data: { id: 285959875, tx_ref: uuid(), flw_ref: 'FLW-MOCK-1', status: 'successful' },
    });
    expect(
      adapter.verifyWebhook({ 'verif-hash': 'provider-test-hash' }, Buffer.from(body)),
    ).toMatchObject({ providerPaymentId: '285959875' });
    expect(() => adapter.verifyWebhook({ 'verif-hash': 'other' }, Buffer.from(body))).toThrow();
  });
});
