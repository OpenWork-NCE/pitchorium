import { createHmac } from 'node:crypto';
import { and, eq, gte, lte } from '@pitchorium/db/orm';
import {
  paymentsSimulatedAccounts,
  paymentsSimulatedSessions,
} from '@pitchorium/db/schemas/payments';
import type { TransactionManager } from '../../../../platform/database';
import { type Clock, DomainError, type IdGenerator, Money } from '../../../../platform/kernel';
import {
  type CreatePayoutAccountRequest,
  type CreateSessionRequest,
  FxRateProvider,
  type PaymentProvider,
  type PaymentSession,
  type PayoutAccountProvider,
  type ProviderRefundRequest,
  type ProviderRefundResult,
  type ProviderTransaction,
  type VerifiedWebhook,
  WebhookRejectedError,
} from '../../application/ports';
import { ceilDiv } from '../../domain/routing';
import type { ContributionRecord, ProviderSnapshot } from '../../domain/contribution';
import type { Rate } from '../../domain/fx';
import type { PayoutAccountState } from '../../domain/payout';
import { safeEqual } from '../provider-http';

export const SIMULATED_SIGNATURE_HEADER = 'x-simulated-signature';
export const SIMULATED_SIGNATURE_TOLERANCE_SECONDS = 300;
/** Fee the simulated provider keeps: 1.5 % rounded up, like a card payment. */
const SIMULATED_FEE_BPS = 150n;

export const SIMULATED_SCENARIOS = [
  'succeed',
  'fail',
  'expire',
  'refund',
  'dispute',
  'win-dispute',
  'lose-dispute',
] as const;
export type SimulatedScenario = (typeof SIMULATED_SCENARIOS)[number];

interface SimulatedRefund {
  id: string;
  amountMinor: string;
  status: 'succeeded';
}

interface SimulatedDispute {
  id: string;
  amountMinor: string;
  status: 'open' | 'won' | 'lost';
}

type SessionRow = typeof paymentsSimulatedSessions.$inferSelect;

/** A signed notification, as the simulated provider delivers it. */
export interface SimulatedWebhook {
  headers: Record<string, string>;
  body: string;
}

export function simulatedSignature(secret: string, timestamp: number, payload: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

/**
 * Simulated provider (ADR 0052): same ports as the live ones, a state kept in its own tables,
 * notifications signed like Stripe's (HMAC SHA-256 of `timestamp.body`), and scenarios to pay,
 * fail, expire, refund and dispute. Development and tests only: refused in production.
 */
export class SimulatedProvider implements PaymentProvider, PayoutAccountProvider {
  readonly id = 'simulated' as const;

  constructor(
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly webhookSecret: string,
    /** Origin of the api: the simulated payment page is served there. */
    private readonly apiPublicUrl: string,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  async createSession(request: CreateSessionRequest): Promise<PaymentSession> {
    const id = `sim_cs_${request.contributionId}`;
    const now = this.clock.now();
    const fee = ceilDiv(request.amount.amountMinor * SIMULATED_FEE_BPS, 10_000n);
    await this.db
      .insert(paymentsSimulatedSessions)
      .values({
        id,
        reference: request.contributionId,
        accountId: request.providerAccountId,
        amountMinor: request.amount.amountMinor,
        currency: request.amount.currency,
        commissionMinor: request.commission.amountMinor,
        feeMinor: fee,
        status: 'open',
        paymentId: null,
        refunds: [],
        disputes: [],
        expiresAt: request.expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    return {
      sessionId: id,
      paymentUrl: `${this.apiPublicUrl}/v1/payments/simulated/checkout/${id}`,
    };
  }

  async retrieve(contribution: ContributionRecord): Promise<ProviderSnapshot> {
    const session = contribution.providerSessionId
      ? await this.session(contribution.providerSessionId)
      : null;
    if (!session) {
      return {
        status: 'pending',
        reference: null,
        amount: null,
        paymentId: null,
        providerFee: null,
        settledEur: null,
        refunds: [],
        disputes: [],
      };
    }
    const money = (minor: bigint | string) => Money.of(BigInt(minor), session.currency);
    const paid = session.status === 'paid';
    const expired =
      session.status === 'expired' ||
      (session.status === 'open' && session.expiresAt <= this.clock.now());
    return {
      status: paid
        ? 'succeeded'
        : session.status === 'failed'
          ? 'failed'
          : expired
            ? 'expired'
            : 'pending',
      reference: session.reference,
      amount: money(session.amountMinor),
      paymentId: session.paymentId,
      providerFee: paid ? money(session.feeMinor) : null,
      settledEur: null,
      refunds: (session.refunds as SimulatedRefund[]).map((refund) => ({
        providerRefundId: refund.id,
        amount: money(refund.amountMinor),
        status: refund.status,
      })),
      disputes: (session.disputes as SimulatedDispute[]).map((dispute) => ({
        providerDisputeId: dispute.id,
        amount: money(dispute.amountMinor),
        status: dispute.status,
      })),
    };
  }

  async refund(request: ProviderRefundRequest): Promise<ProviderRefundResult> {
    const sessionId = request.contribution.providerSessionId;
    const session = sessionId ? await this.session(sessionId) : null;
    if (!session || session.status !== 'paid') {
      throw new DomainError('PAYMENTS_PROVIDER_UNAVAILABLE', 'simulated: nothing to refund');
    }
    const refund: SimulatedRefund = {
      id: `sim_re_${request.refundId}`,
      amountMinor: request.amount.amountMinor.toString(),
      status: 'succeeded',
    };
    const refunds = session.refunds as SimulatedRefund[];
    if (!refunds.some((existing) => existing.id === refund.id)) {
      await this.update(session.id, { refunds: [...refunds, refund] });
    }
    return { providerRefundId: refund.id, status: 'succeeded' };
  }

  refreshRefund(
    _contribution: ContributionRecord,
    providerRefundId: string,
  ): Promise<ProviderRefundResult> {
    return Promise.resolve({ providerRefundId, status: 'succeeded' });
  }

  async listTransactions(
    _accountIds: readonly string[],
    from: Date,
    to: Date,
  ): Promise<ProviderTransaction[]> {
    const rows = await this.db
      .select()
      .from(paymentsSimulatedSessions)
      .where(
        and(
          gte(paymentsSimulatedSessions.createdAt, from),
          lte(paymentsSimulatedSessions.createdAt, to),
          eq(paymentsSimulatedSessions.status, 'paid'),
        ),
      );
    return rows.map((row) => ({
      reference: row.reference,
      providerPaymentId: row.paymentId ?? row.id,
      providerAccountId: row.accountId,
      status: 'succeeded' as const,
      amount: Money.of(row.amountMinor, row.currency),
      refunded: Money.of(
        (row.refunds as SimulatedRefund[]).reduce(
          (sum, refund) => sum + BigInt(refund.amountMinor),
          0n,
        ),
        row.currency,
      ),
      createdAt: row.createdAt,
    }));
  }

  verifyWebhook(
    headers: Record<string, string | undefined>,
    rawBody: Buffer,
    now: Date,
  ): VerifiedWebhook {
    const header = headers[SIMULATED_SIGNATURE_HEADER];
    const parts = new Map(
      (header ?? '').split(',').map((part) => part.split('=', 2) as [string, string]),
    );
    const timestamp = Number(parts.get('t'));
    const signature = parts.get('v1');
    if (!Number.isInteger(timestamp) || !signature) {
      throw new WebhookRejectedError('missing simulated signature');
    }
    const payload = rawBody.toString('utf8');
    if (!safeEqual(signature, simulatedSignature(this.webhookSecret, timestamp, payload))) {
      throw new WebhookRejectedError('signature mismatch');
    }
    if (Math.abs(now.getTime() / 1000 - timestamp) > SIMULATED_SIGNATURE_TOLERANCE_SECONDS) {
      throw new WebhookRejectedError('timestamp outside the tolerance');
    }
    let event: { id?: unknown; type?: unknown; data?: Record<string, unknown> };
    try {
      event = JSON.parse(payload) as typeof event;
    } catch {
      throw new WebhookRejectedError('invalid JSON');
    }
    if (typeof event.id !== 'string' || typeof event.type !== 'string') {
      throw new WebhookRejectedError('missing event id or type');
    }
    const data = event.data ?? {};
    const textOf = (key: string) => (typeof data[key] === 'string' ? data[key] : null);
    return {
      externalId: event.id,
      type: event.type,
      contributionId: textOf('reference'),
      providerPaymentId: textOf('paymentId'),
      providerAccountId: textOf('accountId'),
      paymentReference: null,
    };
  }

  async createAccount(
    request: CreatePayoutAccountRequest,
  ): Promise<{ providerAccountId: string; state: PayoutAccountState }> {
    // One account per holder and country: a change of option opens another one (ADR 0134).
    const id = `sim_acct_${request.userId}_${request.country.toLowerCase()}`;
    await this.db
      .insert(paymentsSimulatedAccounts)
      .values({ id, userId: request.userId, country: request.country, createdAt: this.clock.now() })
      .onConflictDoNothing();
    return { providerAccountId: id, state: { status: 'active', verified: false } };
  }

  onboardingLink(): Promise<string | null> {
    return Promise.resolve(null);
  }

  accountState(): Promise<PayoutAccountState> {
    return Promise.resolve({ status: 'active', verified: false });
  }

  /**
   * Plays a scenario on a session and returns the signed notification the provider sends; the
   * caller delivers it to the webhook endpoint (or to the ingestion service directly).
   */
  async play(
    sessionId: string,
    scenario: SimulatedScenario,
    amountMinor?: bigint,
  ): Promise<SimulatedWebhook> {
    const session = await this.session(sessionId);
    if (!session) throw new DomainError('NOT_FOUND', 'Simulated session not found');
    const disputes = session.disputes as SimulatedDispute[];
    const refunds = session.refunds as SimulatedRefund[];
    const amount = (amountMinor ?? session.amountMinor).toString();
    let type: string;
    switch (scenario) {
      case 'succeed':
        await this.update(sessionId, { status: 'paid', paymentId: `sim_pi_${session.reference}` });
        type = 'payment.succeeded';
        break;
      case 'fail':
        await this.update(sessionId, { status: 'failed' });
        type = 'payment.failed';
        break;
      case 'expire':
        await this.update(sessionId, { status: 'expired' });
        type = 'session.expired';
        break;
      case 'refund':
        await this.update(sessionId, {
          refunds: [
            ...refunds,
            { id: `sim_re_${this.ids.next()}`, amountMinor: amount, status: 'succeeded' },
          ],
        });
        type = 'refund.succeeded';
        break;
      case 'dispute':
        await this.update(sessionId, {
          disputes: [
            ...disputes,
            { id: `sim_dp_${this.ids.next()}`, amountMinor: amount, status: 'open' },
          ],
        });
        type = 'dispute.opened';
        break;
      case 'win-dispute':
      case 'lose-dispute':
        await this.update(sessionId, {
          disputes: disputes.map((dispute) =>
            dispute.status === 'open'
              ? { ...dispute, status: scenario === 'win-dispute' ? 'won' : 'lost' }
              : dispute,
          ),
        });
        type = 'dispute.closed';
        break;
    }
    const updated = await this.session(sessionId);
    return this.sign({
      id: `sim_evt_${this.ids.next()}`,
      type,
      data: {
        reference: session.reference,
        sessionId,
        paymentId: updated?.paymentId ?? null,
        accountId: session.accountId,
      },
    });
  }

  /** Signs a notification with the current time of the clock. */
  sign(event: object): SimulatedWebhook {
    const body = JSON.stringify(event);
    const timestamp = Math.floor(this.clock.now().getTime() / 1000);
    const signature = simulatedSignature(this.webhookSecret, timestamp, body);
    return {
      headers: {
        'content-type': 'application/json',
        [SIMULATED_SIGNATURE_HEADER]: `t=${timestamp},v1=${signature}`,
      },
      body,
    };
  }

  async session(id: string): Promise<SessionRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentsSimulatedSessions)
      .where(eq(paymentsSimulatedSessions.id, id));
    return row ?? null;
  }

  private async update(
    id: string,
    patch: Partial<Pick<SessionRow, 'status' | 'paymentId' | 'refunds' | 'disputes'>>,
  ): Promise<void> {
    await this.db
      .update(paymentsSimulatedSessions)
      .set({ ...patch, updatedAt: this.clock.now() })
      .where(eq(paymentsSimulatedSessions.id, id));
  }
}

/**
 * Rates of the simulated provider for the floating currencies of the demonstration: fixed,
 * marked `simulated`, never shown as real market rates.
 */
const SIMULATED_RATES: Readonly<Record<string, string>> = {
  NGN: '1650',
  GHS: '16.5',
  KES: '140',
};

export class SimulatedFxRateProvider extends FxRateProvider {
  rate(currency: string, at: Date): Promise<Rate> {
    const unitsPerEur = SIMULATED_RATES[currency];
    if (!unitsPerEur) {
      return Promise.reject(
        new DomainError('PAYMENTS_CURRENCY_NOT_AVAILABLE', `No simulated rate for ${currency}`),
      );
    }
    return Promise.resolve({ unitsPerEur, source: 'simulated', at });
  }
}
