import type { PaymentsConfig } from '../../../../platform/config';
import { Money } from '../../../../platform/kernel';
import {
  type CreatePayoutAccountRequest,
  type CreateSessionRequest,
  FxRateProvider,
  type PaymentProvider,
  type PaymentSession,
  type PayoutAccountProvider,
  type ProviderPaymentRef,
  type ProviderRefundRequest,
  type ProviderRefundResult,
  type ProviderTransaction,
  type VerifiedWebhook,
  WebhookRejectedError,
} from '../../application/ports';
import type {
  ContributionRecord,
  ProviderDispute,
  ProviderSnapshot,
} from '../../domain/contribution';
import type { Rate } from '../../domain/fx';
import type { PayoutAccountState } from '../../domain/payout';
import {
  callProvider,
  DecimalLiteral,
  type ExactJson,
  field,
  list,
  parseExactJson,
  safeEqual,
  stringifyWithDecimals,
  text,
  unavailable,
} from '../provider-http';

type FlutterwaveConfig = NonNullable<PaymentsConfig['flutterwave']>;

/** Flutterwave amounts are decimal numbers in major units (`amount: 100.50`), read exactly. */
export function fromFlutterwaveAmount(amount: ExactJson | undefined, currency: string): Money {
  return Money.fromDecimal(normalizeDecimal(text(amount) ?? '0'), currency);
}

/** Drops trailing zeros beyond the exponent that a JSON number may carry (`100.500`). */
function normalizeDecimal(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

function decimal(money: Money): DecimalLiteral {
  return new DecimalLiteral(money.toDecimal());
}

class FlutterwaveClient {
  constructor(private readonly config: FlutterwaveConfig) {}

  async request(path: string, method: 'GET' | 'POST', body?: unknown): Promise<ExactJson> {
    const response = await callProvider('flutterwave', `${this.config.apiBaseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.config.secretKey}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: stringifyWithDecimals(body) } : {}),
    });
    if (response.status >= 400 || text(field(response.body, 'status')) !== 'success') {
      throw unavailable(
        'flutterwave',
        text(field(response.body, 'message')) ?? `HTTP ${response.status}`,
      );
    }
    return field(response.body, 'data') ?? null;
  }

  /** Every item of a paginated list (`meta.page_info.total_pages`). */
  async list(path: string): Promise<ExactJson[]> {
    const items: ExactJson[] = [];
    const separator = path.includes('?') ? '&' : '?';
    for (let page = 1; ; page += 1) {
      const response = await callProvider(
        'flutterwave',
        `${this.config.apiBaseUrl}${path}${separator}page=${page}`,
        { method: 'GET', headers: { authorization: `Bearer ${this.config.secretKey}` } },
      );
      if (response.status >= 400) throw unavailable('flutterwave', `HTTP ${response.status}`);
      items.push(...list(field(response.body, 'data')));
      const pages = Number(text(field(response.body, 'meta', 'page_info', 'total_pages')) ?? '1');
      if (page >= pages) break;
    }
    return items;
  }
}

/**
 * State of a chargeback (developer.flutterwave.com, chargebacks v3): `accepted` by the merchant
 * or `lost` gives the money back to the customer; `won` or `reversed` keeps it; `initiated`,
 * `pending` and `declined` (contested by the merchant) wait for the outcome.
 */
export function chargebackStatus(status: string | null): ProviderDispute['status'] {
  const value = status?.toLowerCase() ?? '';
  if (value === 'lost' || value === 'accepted') return 'lost';
  if (value === 'won' || value === 'reversed') return 'won';
  return 'open';
}

function paymentRef(chargeback: ExactJson): ProviderPaymentRef | null {
  const providerPaymentId = text(field(chargeback, 'transaction_id'));
  return providerPaymentId
    ? { reference: text(field(chargeback, 'tx_ref')), providerPaymentId }
    : null;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Flutterwave v3 (ADR 0045): the payment page is Flutterwave Standard (`POST /v3/payments`),
 * split with the subaccount of the holder: the commission is a flat charge kept by the main
 * account, the holder receives the rest minus the fee. Every webhook is verified again through
 * `GET /v3/transactions/{id}/verify` before any effect.
 */
export class FlutterwaveProvider implements PaymentProvider, PayoutAccountProvider {
  readonly id = 'flutterwave' as const;
  private readonly client: FlutterwaveClient;

  constructor(private readonly config: FlutterwaveConfig) {
    this.client = new FlutterwaveClient(config);
  }

  async createSession(request: CreateSessionRequest): Promise<PaymentSession> {
    const minutes = Math.max(1, Math.ceil((request.expiresAt.getTime() - Date.now()) / 60_000));
    const data = await this.client.request('/v3/payments', 'POST', {
      tx_ref: request.contributionId,
      amount: decimal(request.amount),
      currency: request.amount.currency,
      redirect_url: request.returnUrl,
      customer: { email: request.contributorEmail, name: request.contributorName },
      customizations: { title: request.description },
      session_duration: Math.min(minutes, 1440),
      meta: { contribution_id: request.contributionId },
      subaccounts: [
        {
          id: request.providerAccountId,
          // `flat`: the main account keeps this amount, the subaccount the rest minus the fee.
          transaction_charge_type: 'flat',
          transaction_charge: decimal(request.commission),
        },
      ],
    });
    const link = text(field(data, 'link'));
    if (!link) throw unavailable('flutterwave', 'no payment link');
    return { sessionId: request.contributionId, paymentUrl: link };
  }

  async retrieve(contribution: ContributionRecord): Promise<ProviderSnapshot> {
    if (!contribution.providerPaymentId) {
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
    const data = await this.client.request(
      `/v3/transactions/${contribution.providerPaymentId}/verify`,
      'GET',
    );
    const currency = text(field(data, 'currency')) ?? contribution.currency;
    const status = text(field(data, 'status'));
    const fee = text(field(data, 'app_fee'));
    const flwRef = text(field(data, 'flw_ref'));
    const paymentId = text(field(data, 'id'));
    // Chargebacks are listed apart from the transaction, by its Flutterwave reference.
    const chargebacks =
      status === 'successful' && flwRef
        ? (await this.client.list(`/v3/chargebacks?flw_ref=${encodeURIComponent(flwRef)}`)).filter(
            (item) => text(field(item, 'transaction_id')) === paymentId,
          )
        : [];
    return {
      status: status === 'successful' ? 'succeeded' : status === 'failed' ? 'failed' : 'pending',
      reference: text(field(data, 'tx_ref')),
      amount: fromFlutterwaveAmount(field(data, 'amount'), currency),
      paymentId,
      providerFee: fee ? fromFlutterwaveAmount(fee, currency) : null,
      settledEur: null,
      refunds: [],
      disputes: chargebacks.map((item) => ({
        providerDisputeId: text(field(item, 'id')) ?? '',
        amount: fromFlutterwaveAmount(field(item, 'amount'), currency),
        status: chargebackStatus(text(field(item, 'status'))),
      })),
    };
  }

  /** Chargebacks raised in the period (`GET /v3/chargebacks?from=&to=`). */
  async disputedPayments(from: Date, to: Date): Promise<ProviderPaymentRef[]> {
    const items = await this.client.list(`/v3/chargebacks?from=${day(from)}&to=${day(to)}`);
    return items.flatMap((item) => paymentRef(item) ?? []);
  }

  /** The transaction a chargeback notification names by its `flw_ref`. */
  async paymentOf(paymentReference: string): Promise<ProviderPaymentRef | null> {
    const items = await this.client.list(
      `/v3/chargebacks?flw_ref=${encodeURIComponent(paymentReference)}`,
    );
    return items.map(paymentRef).find((ref) => ref !== null) ?? null;
  }

  async refund(request: ProviderRefundRequest): Promise<ProviderRefundResult> {
    if (!request.contribution.providerPaymentId) throw unavailable('flutterwave', 'no payment');
    const data = await this.client.request(
      `/v3/transactions/${request.contribution.providerPaymentId}/refund`,
      'POST',
      { amount: decimal(request.amount) },
    );
    return {
      providerRefundId: text(field(data, 'id')) ?? '',
      status: refundStatus(text(field(data, 'status'))),
    };
  }

  async refreshRefund(
    _contribution: ContributionRecord,
    providerRefundId: string,
  ): Promise<ProviderRefundResult> {
    const data = await this.client.request(`/v3/refunds/${providerRefundId}`, 'GET');
    return { providerRefundId, status: refundStatus(text(field(data, 'status'))) };
  }

  /** Every payment of the merchant in the period (the subaccounts are split at settlement). */
  async listTransactions(
    _accountIds: readonly string[],
    from: Date,
    to: Date,
  ): Promise<ProviderTransaction[]> {
    const items = await this.client.list(`/v3/transactions?from=${day(from)}&to=${day(to)}`);
    return items.map((item) => {
      const currency = text(field(item, 'currency')) ?? 'NGN';
      const status = text(field(item, 'status'));
      return {
        reference: text(field(item, 'tx_ref')),
        providerPaymentId: text(field(item, 'id')) ?? '',
        providerAccountId: '',
        status: status === 'successful' ? 'succeeded' : status === 'failed' ? 'failed' : 'pending',
        amount: fromFlutterwaveAmount(field(item, 'amount'), currency),
        refunded: null,
        createdAt: new Date(text(field(item, 'created_at')) ?? 0),
      };
    });
  }

  /** v3 sends the secret hash of the dashboard in `verif-hash` (developer.flutterwave.com). */
  verifyWebhook(headers: Record<string, string | undefined>, rawBody: Buffer): VerifiedWebhook {
    const hash = headers['verif-hash'];
    if (!hash || !safeEqual(hash, this.config.webhookSecretHash)) {
      throw new WebhookRejectedError('verif-hash mismatch');
    }
    let event: ExactJson;
    try {
      event = parseExactJson(rawBody.toString('utf8'));
    } catch {
      throw new WebhookRejectedError('invalid JSON');
    }
    const type = text(field(event, 'event')) ?? text(field(event, 'event.type'));
    const id = text(field(event, 'data', 'id'));
    if (!type || !id) throw new WebhookRejectedError('missing event or data.id');
    // v3 notifications carry no event identifier: the type, the object and its status.
    const status = text(field(event, 'data', 'status')) ?? '';
    // A chargeback names the transaction by its `flw_ref`; `data.id` is the chargeback.
    const chargeback = type.startsWith('chargeback.');
    return {
      externalId: `${type}:${id}:${status}`,
      type,
      contributionId: text(field(event, 'data', 'tx_ref')),
      providerPaymentId: chargeback ? text(field(event, 'data', 'transaction_id')) : id,
      providerAccountId: null,
      paymentReference: chargeback ? text(field(event, 'data', 'flw_ref')) : null,
    };
  }

  async createAccount(
    request: CreatePayoutAccountRequest,
  ): Promise<{ providerAccountId: string; state: PayoutAccountState }> {
    if (!request.bankAccount) throw unavailable('flutterwave', 'bank details required');
    const data = await this.client.request('/v3/subaccounts', 'POST', {
      account_bank: request.bankAccount.bankCode,
      account_number: request.bankAccount.accountNumber,
      business_name: request.bankAccount.accountName,
      business_email: request.email,
      business_mobile: request.bankAccount.mobileNumber ?? '',
      country: request.country,
      // Default split, overridden by the flat commission of each payment.
      split_type: 'percentage',
      split_value: new DecimalLiteral(basisPointsAsFraction(request.commissionRateBps)),
      // Set at creation only: an update of the subaccount erases it.
      ...(request.metadata
        ? {
            meta: Object.entries(request.metadata).map(([name, value]) => ({
              meta_name: name,
              meta_value: value,
            })),
          }
        : {}),
    });
    const providerAccountId = text(field(data, 'subaccount_id'));
    if (!providerAccountId) throw unavailable('flutterwave', 'no subaccount');
    return { providerAccountId, state: { status: 'active', verified: false } };
  }

  onboardingLink(): Promise<string | null> {
    return Promise.resolve(null);
  }

  /** A subaccount is usable once created; the holder is verified by the manual review. */
  accountState(): Promise<PayoutAccountState> {
    return Promise.resolve({ status: 'active', verified: false });
  }
}

/** 500 basis points as `0.05`, in integer arithmetic. */
export function basisPointsAsFraction(bps: number): string {
  const whole = Math.trunc(bps / 10_000);
  const fraction = String(bps % 10_000)
    .padStart(4, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function refundStatus(status: string | null): ProviderRefundResult['status'] {
  if (status?.startsWith('completed')) return 'succeeded';
  if (status === 'failed') return 'failed';
  return 'pending';
}

/**
 * Indicative rate of Flutterwave (`GET /v3/transfers/rates`): units of a currency for one euro,
 * locked for the payment session (ADR 0046).
 */
export class FlutterwaveFxRateProvider extends FxRateProvider {
  private readonly client: FlutterwaveClient;

  constructor(config: FlutterwaveConfig) {
    super();
    this.client = new FlutterwaveClient(config);
  }

  async rate(currency: string, at: Date): Promise<Rate> {
    const data = await this.client.request(
      `/v3/transfers/rates?amount=1&destination_currency=EUR&source_currency=${currency}`,
      'GET',
    );
    const rate = text(field(data, 'rate'));
    if (!rate || !/^(0|[1-9]\d*)(\.\d+)?$/.test(rate)) {
      throw unavailable('flutterwave', 'no rate');
    }
    return { unitsPerEur: rate, source: 'provider', at };
  }
}
