import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type {
  Contribution,
  ContributionQuote,
  ImpactDashboard,
  OfflineContribution,
  PaymentOptions,
  PayoutAccount,
  Project,
  SupporterPage,
  TimeEntry,
} from '@pitchorium/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccessModule } from '../../src/modules/access';
import { ContentModule } from '../../src/modules/content';
import { EngagementModule } from '../../src/modules/engagement';
import { EngagementService } from '../../src/modules/engagement/application/engagement.service';
import { IdentityModule } from '../../src/modules/identity';
import { ImpactModule } from '../../src/modules/impact';
import { MediaModule } from '../../src/modules/media';
import { NetworkModule } from '../../src/modules/network';
import { OrganizationsModule } from '../../src/modules/organizations';
import { PaymentsModule } from '../../src/modules/payments';
import { PaymentsMaintenanceService } from '../../src/modules/payments/application/payments-maintenance.service';
import { ReconciliationService } from '../../src/modules/payments/application/reconciliation.service';
import { ConfiguredPaymentProviders } from '../../src/modules/payments/infrastructure/payment-providers';
import type {
  SimulatedProvider,
  SimulatedScenario,
} from '../../src/modules/payments/infrastructure/simulated/simulated.provider';
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
import { Mailpit } from './support/mailpit';
import { createMember, grantRoleWith2fa, type Member } from './support/members';
import {
  addReward,
  collected,
  contribute,
  entrepreneur,
  eur,
  ledgerBalances,
  postWebhook,
  publishedProject,
  readyDocument,
} from './support/payments';
import { createWorkerTestingModule } from './support/worker-testing-module';

/** High rate limits: one contributor pays many times here; 5,000 EUR of enhanced verification. */
const PAYMENTS_ENV = {
  PAYMENTS_MODE: 'simulated',
  PAYMENTS_CONTRIBUTIONS_PER_HOUR: '100',
  PAYMENTS_SESSIONS_PER_METHOD_PER_HOUR: '100',
  PAYMENTS_ENHANCED_VERIFICATION_EUR_MINOR: '500000',
};

/** Payments and engagement (sections 9 and 9.4) with the simulated provider. */
describe('payments', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let simulated: SimulatedProvider;
  let admin: Member;
  let holder: Member;
  let ama: Member;
  let project: Project;
  const mailpit = new Mailpit();

  const deliver = () => worker.get(OutboxRelayService).relayBatch();

  const statusOf = async (id: string) =>
    (
      await query<{ status: string }>('SELECT status FROM payments.contributions WHERE id = $1', [
        id,
      ])
    )[0]?.status;

  /** Relays the outbox until the worker applied the notification. */
  const until = (id: string, status: string) =>
    vi.waitFor(
      async () => {
        await deliver();
        expect(await statusOf(id)).toBe(status);
      },
      { timeout: 30_000, interval: 200 },
    );

  /** Plays a scenario at the simulated provider and delivers its signed notification. */
  const play = async (
    contribution: Contribution,
    scenario: SimulatedScenario,
    amountMinor?: bigint,
  ) => {
    const webhook = await simulated.play(`sim_cs_${contribution.id}`, scenario, amountMinor);
    const response = await postWebhook(app, 'simulated', webhook).expect(200);
    return { webhook, response };
  };

  const pay = async (contribution: Contribution) => {
    await play(contribution, 'succeed');
    await until(contribution.id, 'succeeded');
  };

  beforeAll(async () => {
    ({ app } = await createApiTestApp([], PAYMENTS_ENV));
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
      PAYMENTS_ENV,
    );
    const providers = app.get(ConfiguredPaymentProviders);
    if (!providers.simulated) throw new Error('Simulated provider expected');
    simulated = providers.simulated;
    await truncateAllTables();
    await mailpit.clear();
    admin = await createMember(app, 'admin@example.com', { name: 'Admin' });
    await grantRoleWith2fa(admin, 'admin');
    holder = await entrepreneur(app, 'holder@example.com', 'Fatou Sall');
    ama = await createMember(app, 'ama@example.com', { name: 'Ama Owusu' });
    project = await publishedProject(holder);
  });

  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  it('refuses collected contributions without KYC, then opens them after the review', async () => {
    const options = (await ama.agent.get(`/v1/projects/${project.id}/payment-options`).expect(200))
      .body as PaymentOptions;
    expect(options).toMatchObject({
      acceptsPayments: false,
      unavailableReason: 'holder_not_ready',
      kinds: ['donation', 'reward_crowdfunding', 'love_money'],
      currencies: [],
    });
    const refused = await contribute(ama, project.id, { kind: 'donation', amount: eur(10) }, 409);
    expect(refused).toMatchObject({ code: 'PAYMENTS_HOLDER_NOT_READY' });
    const missing = await holder.agent
      .get('/v1/me/prerequisites/payment.collection.open')
      .expect(200);
    expect(missing.body.missing).toEqual(['kyc_verified', 'payout_account']);
    // Commitments and expressions of interest stay possible before the KYC.
    await ama.agent
      .post(`/v1/projects/${project.id}/offline-contributions`)
      .set('Idempotency-Key', randomUUID())
      .send({ kind: 'love_money_commitment', description: 'Je soutiens Fatou.' })
      .expect(201);

    const account = await holder.agent
      .post('/v1/me/payout-account')
      .set('Idempotency-Key', randomUUID())
      .send({
        country: 'SN',
        bankAccount: { bankCode: 'SN001', accountNumber: '00012345678', accountName: 'Fatou Sall' },
      });
    expect(account.status, JSON.stringify(account.body)).toBe(201);
    expect(account.body as PayoutAccount).toMatchObject({
      status: 'active',
      onboarding: 'bank_details',
      kyc: { mode: 'manual_review', status: 'not_submitted' },
      collectionOpen: false,
    });
    const document = await readyDocument(holder.userId);
    const submission = await holder.agent
      .post('/v1/me/kyc/submissions')
      .set('Idempotency-Key', randomUUID())
      .send({ documentMediaIds: [document], certification: true });
    expect(submission.status, JSON.stringify(submission.body)).toBe(201);
    // The administrator reads the document before deciding.
    await admin.agent.get(`/v1/media/${document}/download-url`).expect(200);
    await ama.agent.get(`/v1/media/${document}/download-url`).expect(404);
    const queue = await admin.agent
      .get('/v1/admin/payments/kyc-submissions?status=pending')
      .expect(200);
    expect(queue.body.items).toHaveLength(1);
    await admin.agent
      .post(`/v1/admin/payments/kyc-submissions/${submission.body.id}/decision`)
      .send({ decision: 'approved', reason: 'Pièce d’identité conforme.' })
      .expect(200);

    const open = (
      await ama.agent.get(`/v1/projects/${project.id}/payment-options?country=SN`).expect(200)
    ).body as PaymentOptions;
    expect(open.acceptsPayments).toBe(true);
    expect(open.currencies.map((currency) => currency.currency)).toEqual(
      expect.arrayContaining(['EUR', 'XOF', 'XAF']),
    );
    const ready = await holder.agent
      .get('/v1/me/prerequisites/payment.collection.open')
      .expect(200);
    expect(ready.body).toMatchObject({ allowed: true, missing: [] });
    const audit = await query<{ action: string }>(
      `SELECT action FROM platform.audit_log WHERE action LIKE 'payments.%' ORDER BY occurred_at`,
    );
    expect(audit.map((row) => row.action)).toEqual([
      'payments.payout-account-created',
      'payments.kyc-submitted',
      'payments.kyc-approved',
    ]);
  });

  it('pays a contribution with a reward end to end: quote, session, webhook, ledger, tier, email', async () => {
    const rewardId = await addReward(holder, project.id, 24, 1);
    const quote = (
      await ama.agent
        .post(`/v1/projects/${project.id}/contribution-quotes`)
        .send({ kind: 'reward_crowdfunding', amount: eur(2_400), rewardId, method: 'card' })
        .expect(200)
    ).body as ContributionQuote;
    expect(quote).toMatchObject({
      amount: eur(2_400),
      eurEquivalent: eur(2_400),
      commission: eur(120),
      commissionRateBps: 500,
      estimatedProviderFee: null,
      reward: { rewardId, eligible: true },
      rate: { unitsPerEur: '1', source: 'identity' },
    });

    const key = randomUUID();
    const send = () =>
      ama.agent
        .post(`/v1/projects/${project.id}/contributions`)
        .set('Idempotency-Key', key)
        .send({
          kind: 'reward_crowdfunding',
          amount: eur(2_400),
          rewardId,
          method: 'card',
          publicDisplay: true,
        });
    const created = await send();
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const contribution = created.body as Contribution;
    expect(contribution).toMatchObject({ status: 'pending_payment', rewardState: 'reserved' });
    expect(contribution.paymentUrl).toContain(
      `/v1/payments/simulated/checkout/sim_cs_${contribution.id}`,
    );
    expect((await send()).headers['idempotent-replayed']).toBe('true');

    await pay(contribution);
    const paid = (await ama.agent.get(`/v1/me/contributions/${contribution.id}`).expect(200))
      .body as Contribution;
    expect(paid).toMatchObject({ status: 'succeeded', rewardState: 'confirmed', paymentUrl: null });
    expect(await collected(project.id)).toBe(240_000n);
    const tiers = (await ama.agent.get(`/v1/projects/${project.id}`).expect(200)).body as Project;
    expect(tiers.tiers[0]?.unlocked).toBe(true);
    const ledger = await query<{ account: string; amount: string }>(
      `SELECT l.account, l.amount_minor::text AS amount FROM payments.ledger_lines l
       JOIN payments.ledger_entries e ON e.id = l.entry_id
       WHERE e.contribution_id = $1 AND l.currency = 'EUR' ORDER BY l.account`,
      [contribution.id],
    );
    expect(Object.fromEntries(ledger.map((line) => [line.account, line.amount]))).toEqual({
      contributor_funds: '-240000',
      funding_sources: '-240000',
      holder_share: String(240_000 - 12_000 - 3600),
      platform_commission: '12000',
      project_funding: '240000',
      provider_fees: '3600',
    });
    expect(Object.values(await ledgerBalances()).every((sum) => sum === '0')).toBe(true);
    const email = await mailpit.waitFor('ama@example.com', 'Sahel Agri');
    expect(email.text).toContain('2400.00 EUR');
    expect(email.text).toMatch(/pas un reçu fiscal|not a tax receipt/);

    const supporters = (
      await request(app.getHttpServer())
        .get(`/v1/public/projects/${project.id}/supporters`)
        .expect(200)
    ).body as SupporterPage;
    expect(supporters).toMatchObject({ contributionCount: 1, commitmentCount: 0 });
    expect(supporters.items.map((item) => item.displayName)).toEqual(['Ama Owusu']);
    const dashboard = (await ama.agent.get('/v1/me/impact-dashboard').expect(200))
      .body as ImpactDashboard;
    await vi.waitFor(async () => {
      await deliver();
      const current = (await ama.agent.get('/v1/me/impact-dashboard').expect(200))
        .body as ImpactDashboard;
      expect(current).toMatchObject({
        givenTotal: eur(2_400),
        givenThisMonth: eur(2_400),
        projectsSupported: 1,
      });
    });
    expect(dashboard.owner).toEqual({ type: 'member', id: ama.userId });
  });

  it('ignores a replayed webhook, refuses a forged one and tolerates the disorder', async () => {
    const contribution = await contribute(ama, project.id, { kind: 'donation', amount: eur(30) });
    const { webhook } = await play(contribution, 'succeed');
    const replay = await postWebhook(app, 'simulated', webhook).expect(200);
    expect(replay.body).toEqual({ received: true, duplicate: true });
    const forged = await postWebhook(app, 'simulated', {
      headers: webhook.headers,
      body: webhook.body.replace(contribution.id, randomUUID()),
    }).expect(400);
    expect(forged.body.code).toBe('PAYMENTS_WEBHOOK_INVALID');
    await request(app.getHttpServer()).post('/v1/payments/webhooks/stripe').send('{}').expect(404);

    // The refund is notified before the success is processed: the final state is the same.
    const refund = await simulated.play(`sim_cs_${contribution.id}`, 'refund');
    await postWebhook(app, 'simulated', refund).expect(200);
    await until(contribution.id, 'refunded');
    expect(await collected(project.id)).toBe(240_000n);
    const entries = await query<{ kind: string }>(
      'SELECT kind FROM payments.ledger_entries WHERE contribution_id = $1 ORDER BY kind',
      [contribution.id],
    );
    expect(entries.map((entry) => entry.kind)).toEqual(['payment_succeeded', 'refund']);
  });

  it('releases the reward of an expired session, and serves the last unit once', async () => {
    const rewardId = await addReward(holder, project.id, 50, 1);
    const first = await contribute(ama, project.id, {
      kind: 'reward_crowdfunding',
      amount: eur(50),
      rewardId,
    });
    const taken = await contribute(
      ama,
      project.id,
      { kind: 'reward_crowdfunding', amount: eur(50), rewardId },
      409,
    );
    expect(taken).toMatchObject({ code: 'PROJECTS_REWARD_SOLD_OUT' });
    await query(
      `UPDATE payments.contributions SET expires_at = now() - interval '10 minutes' WHERE id = $1`,
      [first.id],
    );
    await query(
      `UPDATE payments.simulated_sessions SET expires_at = now() - interval '10 minutes' WHERE reference = $1`,
      [first.id],
    );
    expect(await worker.get(PaymentsMaintenanceService).expirePending()).toBe(1);
    expect(await statusOf(first.id)).toBe('expired');

    // Five members race for the last unit: exactly one reserves it.
    const members = await Promise.all(
      [1, 2, 3, 4, 5].map((index) =>
        createMember(app, `racer${index}@example.com`, { name: `Racer ${index}` }),
      ),
    );
    const results = await Promise.all(
      members.map((member) =>
        member.agent
          .post(`/v1/projects/${project.id}/contributions`)
          .set('Idempotency-Key', randomUUID())
          .send({ kind: 'reward_crowdfunding', amount: eur(50), rewardId, method: 'card' }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(
      results
        .filter((result) => result.status === 409)
        .every((result) => result.body.code === 'PROJECTS_REWARD_SOLD_OUT'),
    ).toBe(true);
  });

  it('refunds in part then in full, the commission in proportion, and reverses the funding', async () => {
    const before = await collected(project.id);
    const contribution = await contribute(ama, project.id, { kind: 'donation', amount: eur(100) });
    await pay(contribution);
    expect(await collected(project.id)).toBe(before + 10_000n);
    await ama.agent
      .post(`/v1/admin/payments/contributions/${contribution.id}/refunds`)
      .send({ reason: 'x' })
      .expect(403);

    const partial = await admin.agent
      .post(`/v1/admin/payments/contributions/${contribution.id}/refunds`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: eur(30), reason: 'Demande du contributeur.' });
    expect(partial.status, JSON.stringify(partial.body)).toBe(201);
    expect(partial.body).toMatchObject({
      status: 'succeeded',
      amount: eur(30),
      commissionRefunded: eur(1.5),
    });
    expect(await statusOf(contribution.id)).toBe('partially_refunded');
    expect(await collected(project.id)).toBe(before + 7_000n);

    const tooMuch = await admin.agent
      .post(`/v1/admin/payments/contributions/${contribution.id}/refunds`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: eur(80), reason: 'Trop.' })
      .expect(409);
    expect(tooMuch.body.code).toBe('PAYMENTS_REFUND_INVALID');
    const total = await admin.agent
      .post(`/v1/admin/payments/contributions/${contribution.id}/refunds`)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'Projet annulé.' })
      .expect(201);
    expect(total.body).toMatchObject({ amount: eur(70), commissionRefunded: eur(3.5) });
    expect(await statusOf(contribution.id)).toBe('refunded');
    expect(await collected(project.id)).toBe(before);
    const details = await admin.agent
      .get(`/v1/admin/payments/contributions/${contribution.id}`)
      .expect(200);
    expect(details.body.refunds).toHaveLength(2);
    expect(details.body.commission).toEqual(eur(0));
  });

  it('reverses the funding of a lost dispute', async () => {
    const before = await collected(project.id);
    const contribution = await contribute(ama, project.id, { kind: 'donation', amount: eur(50) });
    await pay(contribution);
    await play(contribution, 'dispute');
    await until(contribution.id, 'disputed');
    expect(await collected(project.id)).toBe(before + 5_000n);
    await play(contribution, 'lose-dispute');
    await until(contribution.id, 'dispute_lost');
    expect(await collected(project.id)).toBe(before);
    const kinds = await query<{ kind: string }>(
      'SELECT kind FROM payments.ledger_entries WHERE contribution_id = $1 ORDER BY kind',
      [contribution.id],
    );
    expect(kinds.map((row) => row.kind)).toEqual([
      'dispute_lost',
      'dispute_opened',
      'payment_succeeded',
    ]);
  });

  it('pays in XAF with the exact EUR equivalent of the fixed parity', async () => {
    const before = await collected(project.id);
    const quote = await ama.agent
      .post(`/v1/projects/${project.id}/contribution-quotes`)
      .send({
        kind: 'donation',
        amount: { amountMinor: '65596', currency: 'XAF' },
        method: 'mobile_money',
      })
      .expect(200);
    expect(quote.body).toMatchObject({
      eurEquivalent: eur(100),
      commission: { amountMinor: '3279', currency: 'XAF' },
      rate: { unitsPerEur: '655.957', source: 'fixed_parity' },
    });
    const contribution = await contribute(ama, project.id, {
      kind: 'donation',
      amount: { amountMinor: '65596', currency: 'XAF' },
      method: 'mobile_money',
    });
    await pay(contribution);
    expect(await collected(project.id)).toBe(before + 10_000n);
  });

  it('collects for an organization, listed among the projects it supports', async () => {
    const created = await ama.agent
      .post('/v1/organizations')
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Fondation Teranga', structureType: 'foundation', countryCodes: ['SN'] });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const organization = created.body as { id: string; slug: string };
    const response = await ama.agent
      .post(`/v1/organizations/${organization.id}/contributions`)
      .set('Idempotency-Key', randomUUID())
      .send({
        projectId: project.id,
        kind: 'donation',
        amount: eur(200),
        method: 'card',
        publicDisplay: true,
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    await holder.agent
      .post(`/v1/organizations/${organization.id}/contributions`)
      .set('Idempotency-Key', randomUUID())
      .send({ projectId: project.id, kind: 'donation', amount: eur(200), method: 'card' })
      .expect(403);
    await pay(response.body as Contribution);
    const page = await ama.agent.get(`/v1/organizations/by-slug/${organization.slug}`).expect(200);
    expect(page.body.projects.supported).toEqual([
      { projectId: project.id, slug: project.slug, title: project.title },
    ]);
    await vi.waitFor(async () => {
      await deliver();
      const dashboard = await ama.agent
        .get(`/v1/organizations/${organization.id}/impact-dashboard`)
        .expect(200);
      expect(dashboard.body).toMatchObject({ givenTotal: eur(200), projectsSupported: 1 });
    });
  });

  it('counts an off-platform contribution once confirmed and validated on proof', async () => {
    const before = await collected(project.id);
    const declared = await ama.agent
      .post(`/v1/projects/${project.id}/offline-contributions`)
      .set('Idempotency-Key', randomUUID())
      .send({ kind: 'cash', amount: eur(150), description: 'Remis en main propre.' });
    expect(declared.status, JSON.stringify(declared.body)).toBe(201);
    const offline = declared.body as OfflineContribution;
    expect(offline).toMatchObject({
      status: 'declared',
      declaredBy: 'contributor',
      eurEquivalent: eur(150),
    });
    await ama.agent.post(`/v1/offline-contributions/${offline.id}/confirm`).expect(409);
    await holder.agent.post(`/v1/offline-contributions/${offline.id}/confirm`).expect(200);
    const refused = await admin.agent
      .post(`/v1/admin/payments/offline-contributions/${offline.id}/decision`)
      .send({ decision: 'validated', reason: 'Reçu signé.' })
      .expect(409);
    expect(refused.body.code).toBe('PAYMENTS_OFFLINE_PROOF_REQUIRED');
    expect(await collected(project.id)).toBe(before);
    const proof = await readyDocument(ama.userId);
    await ama.agent
      .put(`/v1/offline-contributions/${offline.id}/proofs`)
      .send({ mediaIds: [proof] })
      .expect(200);
    await admin.agent
      .post(`/v1/admin/payments/offline-contributions/${offline.id}/decision`)
      .send({ decision: 'validated', reason: 'Reçu signé.' })
      .expect(200);
    expect(await collected(project.id)).toBe(before + 15_000n);

    // A commitment without money is counted as such, never as an amount.
    const [commitment] = (
      await holder.agent
        .get(`/v1/projects/${project.id}/offline-contributions?status=declared`)
        .expect(200)
    ).body.items as OfflineContribution[];
    if (!commitment) throw new Error('No commitment');
    await holder.agent.post(`/v1/offline-contributions/${commitment.id}/confirm`).expect(200);
    const supporters = await request(app.getHttpServer())
      .get(`/v1/public/projects/${project.id}/supporters`)
      .expect(200);
    expect(supporters.body.commitmentCount).toBe(1);
    await ama.agent
      .post(`/v1/projects/${project.id}/offline-contributions`)
      .set('Idempotency-Key', randomUUID())
      .send({ kind: 'love_money_commitment', amount: eur(10) })
      .expect(422);
  });

  it('exports the contributions of a project as CSV for its owners', async () => {
    const response = await holder.agent
      .get(`/v1/projects/${project.id}/contributions/export`)
      .expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    const lines = response.text.trim().split('\r\n');
    expect(lines[0]).toBe(
      'type,date,contributor,organization,kind,status,currency,amount,eur_equivalent,commission,provider_fee,refunded,holder_net,reward,reward_state,reference',
    );
    expect(lines.filter((line) => line.startsWith('online,')).length).toBeGreaterThanOrEqual(6);
    expect(
      lines.some((line) => line.startsWith('offline,') && line.includes(',cash,validated,')),
    ).toBe(true);
    await ama.agent.get(`/v1/projects/${project.id}/contributions/export`).expect(403);
  });

  it('reconciles without discrepancy, then reports an injected one without correcting it', async () => {
    const clean = await worker.get(ReconciliationService).run();
    expect(clean.discrepancies).toEqual([]);
    expect(clean.checkedTransactions).toBeGreaterThan(0);

    const [paid] = await query<{ id: string }>(
      `SELECT id FROM payments.contributions WHERE status = 'succeeded' ORDER BY created_at LIMIT 1`,
    );
    await query(
      `UPDATE payments.simulated_sessions SET amount_minor = amount_minor + 1 WHERE reference = $1`,
      [paid?.id],
    );
    const report = await worker.get(ReconciliationService).run();
    expect(report.discrepancies.map((found) => found.kind)).toEqual(['amount_mismatch']);
    const listed = await admin.agent
      .get('/v1/admin/payments/discrepancies?status=open')
      .expect(200);
    expect(listed.body.items).toHaveLength(1);
    expect(await statusOf(paid?.id ?? '')).toBe('succeeded');
    await admin.agent
      .post(`/v1/admin/payments/discrepancies/${listed.body.items[0].id}/resolve`)
      .send({ note: 'Écart injecté par le test.' })
      .expect(200);
    await query(
      `UPDATE payments.simulated_sessions SET amount_minor = amount_minor - 1 WHERE reference = $1`,
      [paid?.id],
    );
  });

  it('rebuilds the dashboards by replaying the contributions', async () => {
    // 2,400 EUR with a reward and 100 EUR in XAF in her name; refunded and lost ones count 0.
    const before = await vi.waitFor(async () => {
      await deliver();
      const current = (await ama.agent.get('/v1/me/impact-dashboard').expect(200))
        .body as ImpactDashboard;
      expect(current.givenTotal).toEqual(eur(2_500));
      return current;
    });
    await query('TRUNCATE engagement.contribution_facts');
    const empty = (await ama.agent.get('/v1/me/impact-dashboard').expect(200))
      .body as ImpactDashboard;
    expect(empty.givenTotal).toEqual(eur(0));
    expect(await worker.get(EngagementService).rebuild()).toBeGreaterThan(0);
    const after = (await ama.agent.get('/v1/me/impact-dashboard').expect(200))
      .body as ImpactDashboard;
    expect(after).toEqual(before);
    const history = await ama.agent.get('/v1/me/impact-dashboard/history').expect(200);
    expect(history.text.split('\r\n')[0]).toBe('type,date,project,detail,status,eur,minutes');
  });

  it('logs shared time, confirmed or disputed by its beneficiary', async () => {
    const declare = (body: object) =>
      ama.agent
        .post('/v1/me/time-entries')
        .set('Idempotency-Key', randomUUID())
        .send({
          kind: 'mentoring',
          minutes: 90,
          date: '2026-10-01',
          description: 'Revue du plan de financement.',
          ...body,
        });
    const forProject = (await declare({ projectId: project.id }).expect(201)).body as TimeEntry;
    const handle = (await holder.agent.get('/v1/me/profile').expect(200)).body.handle as string;
    const forHolder = (await declare({ entrepreneurHandle: handle, minutes: 30 }).expect(201))
      .body as TimeEntry;
    await declare({ projectId: project.id, date: '2999-01-01' }).expect(400);
    await ama.agent.post(`/v1/time-entries/${forProject.id}/confirm`).expect(403);
    const received = await holder.agent.get('/v1/me/time-entries/received').expect(200);
    expect(received.body.items).toHaveLength(2);
    await holder.agent.post(`/v1/time-entries/${forProject.id}/confirm`).expect(200);
    await holder.agent
      .post(`/v1/time-entries/${forHolder.id}/dispute`)
      .send({ reason: 'Séance annulée.' })
      .expect(200);
    await holder.agent.post(`/v1/time-entries/${forHolder.id}/confirm`).expect(409);
    const dashboard = (await ama.agent.get('/v1/me/impact-dashboard').expect(200))
      .body as ImpactDashboard;
    expect(dashboard.minutes).toEqual({ declared: 120, confirmed: 90, disputed: 30 });
  });

  it('refuses equity and loans online even with their feature flags on', async () => {
    await query(
      `UPDATE platform.feature_flags SET enabled = true WHERE key IN ('funding.equity', 'funding.loans')`,
    );
    try {
      for (const kind of ['equity', 'loan']) {
        const refused = await contribute(ama, project.id, { kind, amount: eur(1_000) }, 422);
        expect(refused).toMatchObject({ code: 'PAYMENTS_LICENSED_PARTNER_REQUIRED' });
      }
      const grant = await contribute(ama, project.id, { kind: 'grant', amount: eur(1_000) }, 422);
      expect(grant).toMatchObject({ code: 'PAYMENTS_INSTRUMENT_NOT_COLLECTIBLE' });
      // Above the threshold of enhanced verification, two-factor authentication first.
      const large = await contribute(
        ama,
        project.id,
        { kind: 'donation', amount: eur(6_000) },
        403,
      );
      expect(large).toMatchObject({
        code: 'ACCESS_PREREQUISITES_MISSING',
        missing: ['two_factor'],
      });
    } finally {
      await query(
        `UPDATE platform.feature_flags SET enabled = false WHERE key IN ('funding.equity', 'funding.loans')`,
      );
    }
  });
});
