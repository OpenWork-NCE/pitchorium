import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type { PayoutAccount } from '@pitchorium/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccessModule } from '../../src/modules/access';
import { ContentModule } from '../../src/modules/content';
import { EngagementModule } from '../../src/modules/engagement';
import { IdentityModule } from '../../src/modules/identity';
import { ImpactModule } from '../../src/modules/impact';
import { MediaModule } from '../../src/modules/media';
import { NetworkModule } from '../../src/modules/network';
import { OrganizationsModule } from '../../src/modules/organizations';
import { PaymentsModule } from '../../src/modules/payments';
import { ReconciliationService } from '../../src/modules/payments/application/reconciliation.service';
import { ProfilesModule } from '../../src/modules/profiles';
import { ProjectsModule } from '../../src/modules/projects';
import { AuditModule } from '../../src/platform/audit';
import { FeatureFlagsModule } from '../../src/platform/feature-flags';
import { MailerModule } from '../../src/platform/mailer';
import { ObservabilityModule } from '../../src/platform/observability';
import { OutboxRelayService } from '../../src/platform/outbox';
import { StorageModule } from '../../src/platform/storage';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { FakeFlutterwave, FakeStripe } from './support/fake-providers';
import { createMember, grantRoleWith2fa, type Member } from './support/members';
import {
  contribute,
  entrepreneur,
  eur,
  postWebhook,
  publishedProject,
  readyDocument,
} from './support/payments';
import { createWorkerTestingModule } from './support/worker-testing-module';

const STRIPE_WEBHOOK_SECRET = 'whsec_integration';
const FLUTTERWAVE_HASH = 'flutterwave-secret-hash';

/**
 * The live adapters against HTTP servers reproducing the APIs and signatures of Stripe Connect
 * and Flutterwave v3: routing by the payout country, hosted onboarding or subaccount, payment
 * session, signed notification, verification through the API.
 */
describe('payment providers', () => {
  const stripe = new FakeStripe(STRIPE_WEBHOOK_SECRET);
  const flutterwave = new FakeFlutterwave(FLUTTERWAVE_HASH);
  let app: NestExpressApplication;
  let worker: TestingModule;
  let admin: Member;
  let contributor: Member;
  let chargedBackId = '';

  const deliver = () => worker.get(OutboxRelayService).relayBatch();
  const statusOf = async (id: string) =>
    (
      await query<{ status: string }>('SELECT status FROM payments.contributions WHERE id = $1', [
        id,
      ])
    )[0]?.status;
  const until = (id: string, status: string) =>
    vi.waitFor(
      async () => {
        await deliver();
        expect(await statusOf(id)).toBe(status);
      },
      { timeout: 30_000, interval: 200 },
    );

  beforeAll(async () => {
    const env = {
      PAYMENTS_MODE: 'live',
      STRIPE_SECRET_KEY: 'sk_test_integration',
      STRIPE_WEBHOOK_SECRET,
      STRIPE_API_BASE_URL: await stripe.start(),
      FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-integration',
      FLUTTERWAVE_WEBHOOK_SECRET_HASH: FLUTTERWAVE_HASH,
      FLUTTERWAVE_API_BASE_URL: await flutterwave.start(),
    };
    ({ app } = await createApiTestApp([], env));
    worker = await createWorkerTestingModule(
      [],
      [
        ObservabilityModule,
        FeatureFlagsModule,
        AuditModule,
        MailerModule,
        StorageModule,
        IdentityModule.forWorker(),
        AccessModule.forWorker(),
        MediaModule.forWorker(),
        ProfilesModule.forWorker(),
        OrganizationsModule.forWorker(),
        NetworkModule.forWorker(),
        ContentModule.forWorker(),
        ImpactModule.forWorker(),
        ProjectsModule.forWorker(),
        PaymentsModule.forWorker(),
        EngagementModule.forWorker(),
      ],
      undefined,
      env,
    );
    await truncateAllTables();
    admin = await createMember(app, 'admin@example.com', { name: 'Admin' });
    await grantRoleWith2fa(admin, 'admin');
    contributor = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
  });

  afterAll(async () => {
    await worker?.close();
    await app?.close();
    await stripe.stop();
    await flutterwave.stop();
  });

  it('routes a holder in France to Stripe Connect: hosted onboarding, direct charge, signed event', async () => {
    const holder = await entrepreneur(app, 'claire@example.com', 'Claire Martin');
    const project = await publishedProject(holder, 'Atelier solaire de Pointe-à-Pitre');
    const created = await holder.agent
      .post('/v1/me/payout-account')
      .set('Idempotency-Key', randomUUID())
      .send({ country: 'FR' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body as PayoutAccount).toMatchObject({
      status: 'pending',
      onboarding: 'hosted',
      kyc: { mode: 'provider', status: 'not_submitted' },
      collectionOpen: false,
    });
    expect((created.body as PayoutAccount).onboardingUrl).toMatch(
      /^https:\/\/connect\.stripe\.test\/setup\/acct_/,
    );
    const accountRequest = stripe.received.find((entry) => entry.path === '/v1/accounts');
    expect(
      new URLSearchParams(accountRequest?.body).get('controller[stripe_dashboard][type]'),
    ).toBe('full');
    const [accountId] = [...stripe.accounts.keys()];
    stripe.completeOnboarding(accountId ?? '');
    const refreshed = await holder.agent.post('/v1/me/payout-account/refresh').expect(200);
    expect(refreshed.body).toMatchObject({
      status: 'active',
      kyc: { status: 'verified' },
      collectionOpen: true,
    });
    await holder.agent
      .post('/v1/me/kyc/submissions')
      .set('Idempotency-Key', randomUUID())
      .send({ documentMediaIds: [await readyDocument(holder.userId)], certification: true })
      .expect(409);

    // PayPal is not offered: Stripe does not support it with direct charges.
    const paypal = await contribute(
      contributor,
      project.id,
      { kind: 'donation', amount: eur(100), method: 'paypal' },
      422,
    );
    expect(paypal).toMatchObject({ code: 'PAYMENTS_METHOD_NOT_AVAILABLE' });
    const quote = await contributor.agent
      .post(`/v1/projects/${project.id}/contribution-quotes`)
      .send({ kind: 'donation', amount: eur(100), method: 'card' })
      .expect(200);
    expect(quote.body).toMatchObject({
      commission: eur(5),
      estimatedProviderFee: { amountMinor: '175' },
      estimatedHolderAmount: { amountMinor: '9325' },
    });
    const contribution = await contribute(contributor, project.id, {
      kind: 'donation',
      amount: eur(100),
    });
    const [session] = [...stripe.sessions.values()];
    expect(session).toMatchObject({
      account: accountId,
      amount: 10_000,
      applicationFee: 500,
      reference: contribution.id,
    });
    expect(contribution.paymentUrl).toBe(`https://checkout.stripe.test/${session?.id}`);

    const paid = stripe.pay(session?.id ?? '');
    const event = stripe.event(
      'checkout.session.completed',
      { ...stripe.sessionObject(paid), payment_intent: paid.intent },
      accountId ?? '',
    );
    const forged = {
      ...event,
      headers: {
        ...event.headers,
        'stripe-signature': event.headers['stripe-signature'].replace(
          /v1=[0-9a-f]+/,
          `v1=${'0'.repeat(64)}`,
        ),
      },
    };
    expect((await postWebhook(app, 'stripe', forged).expect(400)).body.code).toBe(
      'PAYMENTS_WEBHOOK_INVALID',
    );
    const stale = stripe.event(
      'checkout.session.completed',
      {},
      accountId ?? '',
      Math.floor(Date.now() / 1000) - 3600,
    );
    await postWebhook(app, 'stripe', stale).expect(400);
    await postWebhook(app, 'stripe', event).expect(200);
    await until(contribution.id, 'succeeded');
    const [row] = await query<{ provider_fee_minor: string; provider_payment_id: string }>(
      'SELECT provider_fee_minor::text, provider_payment_id FROM payments.contributions WHERE id = $1',
      [contribution.id],
    );
    expect(row).toEqual({ provider_fee_minor: '175', provider_payment_id: paid.intent });
  });

  it('routes a holder in Nigeria to a Flutterwave subaccount, verifies each notification by the API', async () => {
    const holder = await entrepreneur(app, 'chinedu@example.com', 'Chinedu Okafor');
    const project = await publishedProject(holder, 'Lagos Recycle');
    const created = await holder.agent
      .post('/v1/me/payout-account')
      .set('Idempotency-Key', randomUUID())
      .send({
        country: 'NG',
        bankAccount: { bankCode: '044', accountNumber: '0690000031', accountName: 'Lagos Recycle' },
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({
      currency: 'NGN',
      onboarding: 'bank_details',
      kyc: { mode: 'manual_review' },
    });
    const unsupported = await (
      await entrepreneur(app, 'awa@example.com', 'Awa Ndiaye')
    ).agent
      .post('/v1/me/payout-account')
      .set('Idempotency-Key', randomUUID())
      .send({
        country: 'SN',
        bankAccount: { bankCode: 'SN01', accountNumber: '0001112223', accountName: 'Awa' },
      })
      .expect(422);
    expect(unsupported.body.code).toBe('PAYMENTS_PAYOUT_COUNTRY_NOT_SUPPORTED');
    const submission = await holder.agent
      .post('/v1/me/kyc/submissions')
      .set('Idempotency-Key', randomUUID())
      .send({ documentMediaIds: [await readyDocument(holder.userId)], certification: true })
      .expect(201);
    await admin.agent
      .post(`/v1/admin/payments/kyc-submissions/${submission.body.id}/decision`)
      .send({ decision: 'approved', reason: 'Conforme.' })
      .expect(200);

    // Payments in naira only on this route; the rate comes from the provider.
    const euro = await contribute(
      contributor,
      project.id,
      { kind: 'donation', amount: eur(10), country: 'NG' },
      422,
    );
    expect(euro).toMatchObject({ code: 'PAYMENTS_CURRENCY_NOT_AVAILABLE' });
    const naira = { amountMinor: '16505000', currency: 'NGN' };
    const contribution = await contribute(contributor, project.id, {
      kind: 'donation',
      amount: naira,
      method: 'card',
      country: 'NG',
    });
    expect(contribution).toMatchObject({
      eurEquivalent: eur(100),
      rate: { unitsPerEur: '1650.5', source: 'provider' },
      commission: { amountMinor: '825250', currency: 'NGN' },
    });
    const payment = flutterwave.payments.get(contribution.id);
    expect(payment).toMatchObject({ amount: '165050.00', charge: '8252.50', currency: 'NGN' });

    await postWebhook(
      app,
      'flutterwave',
      flutterwave.webhook(flutterwave.pay(contribution.id), 'wrong'),
    ).expect(400);
    await postWebhook(
      app,
      'flutterwave',
      flutterwave.webhook(flutterwave.pay(contribution.id)),
    ).expect(200);
    await until(contribution.id, 'succeeded');

    // A chargeback notification names the transaction by its flw_ref only: the chargebacks of
    // the provider give the transaction, whose read reports the open dispute.
    const chargeback = flutterwave.chargeback(flutterwave.payments.get(contribution.id)!);
    await postWebhook(app, 'flutterwave', flutterwave.chargebackWebhook(chargeback)).expect(200);
    await until(contribution.id, 'disputed');
    // The outcome comes without notification: the reconciliation reads the chargebacks.
    chargeback.status = 'lost';
    chargedBackId = contribution.id;

    // A notification whose verification disagrees is never applied: a discrepancy instead.
    const tampered = await contribute(contributor, project.id, {
      kind: 'donation',
      amount: naira,
      method: 'card',
      country: 'NG',
    });
    await postWebhook(
      app,
      'flutterwave',
      flutterwave.webhook(flutterwave.pay(tampered.id, '1.00')),
    ).expect(200);
    await vi.waitFor(
      async () => {
        await deliver();
        const found = await query<{ kind: string }>(
          `SELECT kind FROM payments.discrepancies WHERE contribution_id = $1`,
          [tampered.id],
        );
        expect(found.map((item) => item.kind)).toEqual(['amount_mismatch']);
      },
      { timeout: 30_000, interval: 200 },
    );
    expect(await statusOf(tampered.id)).toBe('pending_payment');
  });

  it('reconciles the provider transactions with the ledger', async () => {
    const report = await worker.get(ReconciliationService).run();
    expect(report.checkedTransactions).toBe(3);
    // The tampered payment is known to the provider but not applied here.
    expect(report.discrepancies.map((found) => found.kind)).toEqual(['status_mismatch']);
    expect(await statusOf(chargedBackId)).toBe('dispute_lost');
  });
});
