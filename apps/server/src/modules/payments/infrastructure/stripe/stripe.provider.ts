import { createHmac } from 'node:crypto';
import type { PaymentsConfig } from '../../../../platform/config';
import { Money } from '../../../../platform/kernel';
import type { ContributionRecord, ProviderSnapshot } from '../../domain/contribution';
import type { PayoutAccountState } from '../../domain/payout';
import {
  type CreatePayoutAccountRequest,
  type CreateSessionRequest,
  type PaymentProvider,
  type PaymentSession,
  type PayoutAccountProvider,
  type ProviderRefundRequest,
  type ProviderRefundResult,
  type ProviderTransaction,
  type VerifiedWebhook,
  WebhookRejectedError,
} from '../../application/ports';
import {
  callProvider,
  type ExactJson,
  field,
  list,
  parseExactJson,
  safeEqual,
  text,
  unavailable,
} from '../provider-http';

/** Tolerance of the signature timestamp, as the official libraries (5 minutes). */
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Version of the Accounts v2 API (docs.stripe.com/api/v2/core/accounts), pinned: v2 endpoints
 * require a Stripe-Version header. Checked against the test mode on 2026-10-08.
 */
export const STRIPE_V2_API_VERSION = '2026-09-30.endive';

/** Currencies Stripe still writes with two decimals although ISO 4217 gives none. */
const STRIPE_TWO_DECIMAL_EXCEPTIONS = new Set(['ISK', 'UGX']);

/** Amount as Stripe expects it (docs.stripe.com/currencies): minor units, special cases apart. */
export function toStripeAmount(money: Money): string {
  const minor = STRIPE_TWO_DECIMAL_EXCEPTIONS.has(money.currency)
    ? money.amountMinor * 100n
    : money.amountMinor;
  return minor.toString();
}

export function fromStripeAmount(amount: ExactJson | undefined, currency: string): Money {
  const code = currency.toUpperCase();
  const minor = BigInt(text(amount) ?? '0');
  return Money.of(STRIPE_TWO_DECIMAL_EXCEPTIONS.has(code) ? minor / 100n : minor, code);
}

/** Nested parameters in Stripe's form encoding: `a[b][0][c]=v`. */
function encode(params: Record<string, string | undefined>): string {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) form.append(key, value);
  }
  return form.toString();
}

/** Stripe signs `t.payload` with HMAC SHA-256 (docs.stripe.com/webhooks, manual verification). */
export function stripeSignature(secret: string, timestamp: number, payload: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

/**
 * Stripe Connect (ADR 0044): accounts equivalent to Standard ones (full Dashboard, Stripe
 * responsible for losses and requirements, the account paying its fees) and direct charges
 * through Checkout, with the commission as application fee. The funds go to the balance of the
 * connected account; only the commission reaches the platform.
 */
export class StripeProvider implements PaymentProvider, PayoutAccountProvider {
  readonly id = 'stripe' as const;

  constructor(private readonly config: NonNullable<PaymentsConfig['stripe']>) {}

  async createSession(request: CreateSessionRequest): Promise<PaymentSession> {
    const methods = request.method === 'sepa_debit' ? 'sepa_debit' : 'card'; // Apple Pay and Google Pay come with card.
    const body = await this.post(
      '/v1/checkout/sessions',
      {
        mode: 'payment',
        client_reference_id: request.contributionId,
        'metadata[contribution_id]': request.contributionId,
        'payment_intent_data[metadata][contribution_id]': request.contributionId,
        'payment_intent_data[application_fee_amount]': toStripeAmount(request.commission),
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': request.amount.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': toStripeAmount(request.amount),
        'line_items[0][price_data][product_data][name]': request.description,
        'payment_method_types[0]': methods,
        customer_email: request.contributorEmail,
        locale: request.locale === 'fr' || request.locale === 'en' ? request.locale : 'auto',
        expires_at: String(Math.floor(request.expiresAt.getTime() / 1000)),
        success_url: `${request.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: request.returnUrl,
        submit_type: 'donate',
      },
      { account: request.providerAccountId, idempotencyKey: `session-${request.contributionId}` },
    );
    const sessionId = text(field(body, 'id'));
    const url = text(field(body, 'url'));
    if (!sessionId || !url) throw unavailable('stripe', 'no checkout session');
    return { sessionId, paymentUrl: url };
  }

  async retrieve(contribution: ContributionRecord): Promise<ProviderSnapshot> {
    if (!contribution.providerSessionId) return emptySnapshot('pending');
    const session = await this.get(
      `/v1/checkout/sessions/${contribution.providerSessionId}`,
      {
        'expand[0]': 'payment_intent.latest_charge.balance_transaction',
        'expand[1]': 'payment_intent.latest_charge.refunds',
      },
      contribution.providerAccountId,
    );
    const intent = field(session, 'payment_intent');
    const charge = field(intent, 'latest_charge');
    const currency = text(field(session, 'currency')) ?? contribution.currency;
    const paymentId = text(field(intent, 'id'));
    const disputes: ProviderSnapshot['disputes'][number][] = [];
    if (paymentId && field(charge, 'disputed') === true) {
      const listed = await this.get(
        '/v1/disputes',
        { payment_intent: paymentId, limit: '100' },
        contribution.providerAccountId,
      );
      disputes.push(
        ...list(field(listed, 'data')).map((dispute) => ({
          providerDisputeId: text(field(dispute, 'id')) ?? '',
          amount: fromStripeAmount(field(dispute, 'amount'), currency),
          status: disputeStatus(text(field(dispute, 'status'))),
        })),
      );
    }
    return {
      status: sessionStatus(session, intent),
      reference: text(field(session, 'client_reference_id')),
      amount: fromStripeAmount(field(session, 'amount_total'), currency),
      paymentId,
      providerFee: stripeFee(field(charge, 'balance_transaction'), currency),
      settledEur: null,
      refunds: list(field(charge, 'refunds', 'data')).map((refund) => ({
        providerRefundId: text(field(refund, 'id')) ?? '',
        amount: fromStripeAmount(field(refund, 'amount'), currency),
        status: refundStatus(text(field(refund, 'status'))),
      })),
      disputes,
    };
  }

  async refund(request: ProviderRefundRequest): Promise<ProviderRefundResult> {
    if (!request.contribution.providerPaymentId) throw unavailable('stripe', 'no payment');
    const body = await this.post(
      '/v1/refunds',
      {
        payment_intent: request.contribution.providerPaymentId,
        amount: toStripeAmount(request.amount),
        // The application fee of a direct charge is refunded in proportion
        // (docs.stripe.com/connect/direct-charges); a charge without connected account has none,
        // and Stripe refuses the parameter there.
        ...(request.contribution.providerAccountId ? { refund_application_fee: 'true' } : {}),
        'metadata[refund_id]': request.refundId,
      },
      {
        account: request.contribution.providerAccountId,
        idempotencyKey: `refund-${request.refundId}`,
      },
    );
    return {
      providerRefundId: text(field(body, 'id')) ?? '',
      status: refundStatus(text(field(body, 'status'))),
    };
  }

  async refreshRefund(
    contribution: ContributionRecord,
    providerRefundId: string,
  ): Promise<ProviderRefundResult> {
    const body = await this.get(
      `/v1/refunds/${providerRefundId}`,
      {},
      contribution.providerAccountId,
    );
    return { providerRefundId, status: refundStatus(text(field(body, 'status'))) };
  }

  async listTransactions(
    accountIds: readonly string[],
    from: Date,
    to: Date,
  ): Promise<ProviderTransaction[]> {
    const transactions: ProviderTransaction[] = [];
    for (const account of accountIds) {
      let startingAfter: string | undefined;
      for (;;) {
        const page = await this.get(
          '/v1/charges',
          {
            'created[gte]': String(Math.floor(from.getTime() / 1000)),
            'created[lte]': String(Math.floor(to.getTime() / 1000)),
            limit: '100',
            ...(startingAfter ? { starting_after: startingAfter } : {}),
          },
          account,
        );
        const charges = list(field(page, 'data'));
        for (const charge of charges) {
          const currency = text(field(charge, 'currency')) ?? 'eur';
          const status = text(field(charge, 'status'));
          transactions.push({
            reference: text(field(charge, 'metadata', 'contribution_id')),
            providerPaymentId: text(field(charge, 'payment_intent')) ?? '',
            providerAccountId: account,
            status:
              status === 'succeeded' ? 'succeeded' : status === 'failed' ? 'failed' : 'pending',
            amount: fromStripeAmount(field(charge, 'amount'), currency),
            refunded: fromStripeAmount(field(charge, 'amount_refunded'), currency),
            createdAt: new Date(Number(text(field(charge, 'created')) ?? '0') * 1000),
          });
        }
        if (field(page, 'has_more') !== true || charges.length === 0) break;
        startingAfter = text(field(charges.at(-1), 'id')) ?? undefined;
      }
    }
    return transactions;
  }

  /** Events of the connected accounts (direct charges) come to one Connect endpoint. */
  verifyWebhook(
    headers: Record<string, string | undefined>,
    rawBody: Buffer,
    now: Date,
  ): VerifiedWebhook {
    const header = headers['stripe-signature'];
    if (!header) throw new WebhookRejectedError('missing Stripe-Signature');
    const parts = header.split(',').map((part) => part.split('=', 2) as [string, string]);
    const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
    const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
    if (!Number.isInteger(timestamp) || signatures.length === 0) {
      throw new WebhookRejectedError('malformed Stripe-Signature');
    }
    const expected = stripeSignature(
      this.config.webhookSecret,
      timestamp,
      rawBody.toString('utf8'),
    );
    if (!signatures.some((signature) => safeEqual(signature, expected))) {
      throw new WebhookRejectedError('signature mismatch');
    }
    if (Math.abs(now.getTime() / 1000 - timestamp) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
      throw new WebhookRejectedError('timestamp outside the tolerance');
    }
    let event: ExactJson;
    try {
      event = parseExactJson(rawBody.toString('utf8'));
    } catch {
      throw new WebhookRejectedError('invalid JSON');
    }
    const externalId = text(field(event, 'id'));
    const type = text(field(event, 'type'));
    if (!externalId || !type) throw new WebhookRejectedError('missing event id or type');
    const object = field(event, 'data', 'object');
    const isSession = type.startsWith('checkout.session.');
    return {
      externalId,
      type,
      contributionId: isSession
        ? text(field(object, 'client_reference_id'))
        : text(field(object, 'metadata', 'contribution_id')),
      providerPaymentId: isSession
        ? text(field(object, 'payment_intent'))
        : text(field(object, 'payment_intent')),
      providerAccountId:
        type === 'account.updated' ? text(field(object, 'id')) : text(field(event, 'account')),
      paymentReference: null,
    };
  }

  /**
   * Accounts v2 (Stripe refuses Accounts v1 for new Connect integrations): merchant
   * configuration with card and SEPA debit, full Dashboard, Stripe collecting the fees and
   * bearing the losses. No identity data is sent: a platform based in France may only pass it
   * through account tokens, and Stripe collects it during the hosted onboarding. The account
   * is then read through the v1 API, which serves v2 accounts.
   */
  async createAccount(
    request: CreatePayoutAccountRequest,
  ): Promise<{ providerAccountId: string; state: PayoutAccountState }> {
    const body = await this.request(
      '/v2/core/accounts',
      'POST',
      JSON.stringify({
        identity: { country: request.country.toLowerCase() },
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
        metadata: { ...request.metadata, user_id: request.userId },
      }),
      { idempotencyKey: `account-${request.userId}`, json: true },
    );
    const providerAccountId = text(field(body, 'id'));
    if (!providerAccountId) throw unavailable('stripe', 'no account');
    return { providerAccountId, state: await this.accountState(providerAccountId) };
  }

  async onboardingLink(providerAccountId: string, returnUrl: string): Promise<string | null> {
    const body = await this.post('/v1/account_links', {
      account: providerAccountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: returnUrl,
    });
    return text(field(body, 'url'));
  }

  async accountState(providerAccountId: string): Promise<PayoutAccountState> {
    return accountState(await this.get(`/v1/accounts/${providerAccountId}`, {}));
  }

  private async post(
    path: string,
    params: Record<string, string | undefined>,
    options: { account?: string; idempotencyKey?: string } = {},
  ): Promise<ExactJson> {
    return this.request(path, 'POST', encode(params), options);
  }

  private async get(
    path: string,
    params: Record<string, string>,
    account?: string,
  ): Promise<ExactJson> {
    const query = encode(params);
    return this.request(query ? `${path}?${query}` : path, 'GET', undefined, { account });
  }

  private async request(
    path: string,
    method: 'GET' | 'POST',
    body: string | undefined,
    options: { account?: string | undefined; idempotencyKey?: string; json?: boolean },
  ): Promise<ExactJson> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.config.secretKey}`,
    };
    if (options.json) {
      headers['content-type'] = 'application/json';
      headers['stripe-version'] = STRIPE_V2_API_VERSION;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    if (options.account) headers['stripe-account'] = options.account;
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
    const response = await callProvider('stripe', `${this.config.apiBaseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
    });
    if (response.status >= 400) {
      const message = text(field(response.body, 'error', 'message')) ?? `HTTP ${response.status}`;
      throw unavailable('stripe', message);
    }
    return response.body;
  }
}

function emptySnapshot(status: ProviderSnapshot['status']): ProviderSnapshot {
  return {
    status,
    reference: null,
    amount: null,
    paymentId: null,
    providerFee: null,
    settledEur: null,
    refunds: [],
    disputes: [],
  };
}

function sessionStatus(
  session: ExactJson,
  intent: ExactJson | undefined,
): ProviderSnapshot['status'] {
  const status = text(field(session, 'status'));
  const paymentStatus = text(field(session, 'payment_status'));
  if (status === 'expired') return 'expired';
  if (paymentStatus === 'paid') return 'succeeded';
  // A delayed method (SEPA) that failed sends the intent back to requires_payment_method.
  if (status === 'complete' && text(field(intent, 'status')) === 'requires_payment_method') {
    return 'failed';
  }
  if (text(field(intent, 'status')) === 'canceled') return 'canceled';
  return 'pending';
}

/** Stripe fee of the charge, the application fee (commission) apart. */
function stripeFee(balance: ExactJson | undefined, currency: string): Money | null {
  const details = list(field(balance, 'fee_details'));
  if (details.length === 0) return null;
  const fee = details
    .filter((detail) => text(field(detail, 'type')) === 'stripe_fee')
    .reduce((sum, detail) => sum + BigInt(text(field(detail, 'amount')) ?? '0'), 0n);
  return fromStripeAmount(fee.toString(), currency);
}

function refundStatus(status: string | null): ProviderRefundResult['status'] {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'failed' || status === 'canceled') return 'failed';
  return 'pending';
}

function disputeStatus(status: string | null): 'open' | 'won' | 'lost' {
  if (status === 'won') return 'won';
  if (status === 'lost') return 'lost';
  return 'open';
}

function accountState(account: ExactJson): PayoutAccountState {
  const active =
    field(account, 'charges_enabled') === true && field(account, 'payouts_enabled') === true;
  const disabled = text(field(account, 'requirements', 'disabled_reason'));
  return {
    status: active
      ? 'active'
      : disabled && field(account, 'details_submitted') === true
        ? 'restricted'
        : 'pending',
    verified: active,
  };
}
