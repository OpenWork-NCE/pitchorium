import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { stripeSignature } from '../../../src/modules/payments/infrastructure/stripe/stripe.provider';

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/** A tiny HTTP server answering with the given router; `received` keeps every request. */
abstract class FakeServer {
  private server: Server | undefined;
  readonly received: {
    method: string;
    path: string;
    headers: IncomingMessage['headers'];
    body: string;
  }[] = [];

  protected abstract route(
    method: string,
    path: string,
    query: URLSearchParams,
    body: string,
    headers: IncomingMessage['headers'],
  ): { status: number; body: string };

  async start(): Promise<string> {
    this.server = createServer((request: IncomingMessage, response: ServerResponse) => {
      void readBody(request).then((body) => {
        const url = new URL(request.url ?? '/', 'http://fake');
        this.received.push({
          method: request.method ?? 'GET',
          path: url.pathname,
          headers: request.headers,
          body,
        });
        const result = this.route(
          request.method ?? 'GET',
          url.pathname,
          url.searchParams,
          body,
          request.headers,
        );
        response.statusCode = result.status;
        response.setHeader('content-type', 'application/json');
        response.end(result.body);
      });
    });
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server?.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }
}

interface StripeSession {
  id: string;
  account: string;
  amount: number;
  currency: string;
  reference: string;
  applicationFee: number;
  status: 'open' | 'complete' | 'expired';
  paid: boolean;
  intent: string | null;
}

const ok = (body: unknown) => ({ status: 200, body: JSON.stringify(body) });
const notFound = () => ({ status: 404, body: JSON.stringify({ error: { message: 'not found' } }) });

/** Reproduces the Stripe endpoints used by the adapter (Connect, Checkout, refunds, events). */
export class FakeStripe extends FakeServer {
  readonly accounts = new Map<string, { enabled: boolean }>();
  readonly sessions = new Map<string, StripeSession>();
  private sequence = 0;

  constructor(private readonly webhookSecret: string) {
    super();
  }

  completeOnboarding(accountId: string): void {
    this.accounts.set(accountId, { enabled: true });
  }

  pay(sessionId: string): StripeSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`No session ${sessionId}`);
    session.status = 'complete';
    session.paid = true;
    session.intent = `pi_${(this.sequence += 1)}`;
    return session;
  }

  /** A Connect event signed like Stripe: `t=...,v1=HMAC(t.body)`. */
  event(type: string, object: unknown, account: string, timestamp = Math.floor(Date.now() / 1000)) {
    const body = JSON.stringify({
      id: `evt_${(this.sequence += 1)}`,
      type,
      account,
      data: { object },
    });
    return {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${timestamp},v1=${stripeSignature(this.webhookSecret, timestamp, body)}`,
      },
      body,
    };
  }

  sessionObject(session: StripeSession) {
    return {
      id: session.id,
      object: 'checkout.session',
      status: session.status,
      payment_status: session.paid ? 'paid' : 'unpaid',
      amount_total: session.amount,
      currency: session.currency,
      client_reference_id: session.reference,
      payment_intent: session.paid
        ? {
            id: session.intent,
            status: 'succeeded',
            latest_charge: {
              id: `ch_${session.intent}`,
              disputed: false,
              balance_transaction: {
                fee_details: [
                  { type: 'stripe_fee', amount: 175 },
                  { type: 'application_fee', amount: session.applicationFee },
                ],
              },
              refunds: { data: [] },
            },
          }
        : null,
    };
  }

  protected route(
    method: string,
    path: string,
    query: URLSearchParams,
    body: string,
    headers: IncomingMessage['headers'],
  ) {
    const form = new URLSearchParams(body);
    const account = String(headers['stripe-account'] ?? '');
    // Accounts v2 (JSON, pinned Stripe-Version); the account is then read through v1.
    if (method === 'POST' && path === '/v2/core/accounts') {
      if (!headers['stripe-version']) {
        return {
          status: 400,
          body: JSON.stringify({ error: { message: 'Stripe-Version required' } }),
        };
      }
      const id = `acct_${(this.sequence += 1)}`;
      this.accounts.set(id, { enabled: false });
      return ok({ id, object: 'v2.core.account', applied_configurations: ['merchant'] });
    }
    if (method === 'POST' && path === '/v1/account_links') {
      return ok({ url: `https://connect.stripe.test/setup/${form.get('account')}` });
    }
    const accountMatch = /^\/v1\/accounts\/([^/]+)$/.exec(path);
    if (method === 'GET' && accountMatch?.[1]) {
      const found = this.accounts.get(accountMatch[1]);
      if (!found) return notFound();
      return ok({
        id: accountMatch[1],
        charges_enabled: found.enabled,
        payouts_enabled: found.enabled,
        details_submitted: found.enabled,
      });
    }
    if (method === 'POST' && path === '/v1/checkout/sessions') {
      const id = `cs_${(this.sequence += 1)}`;
      this.sessions.set(id, {
        id,
        account,
        amount: Number(form.get('line_items[0][price_data][unit_amount]')),
        currency: form.get('line_items[0][price_data][currency]') ?? 'eur',
        reference: form.get('client_reference_id') ?? '',
        applicationFee: Number(form.get('payment_intent_data[application_fee_amount]')),
        status: 'open',
        paid: false,
        intent: null,
      });
      return ok({ id, url: `https://checkout.stripe.test/${id}` });
    }
    const sessionMatch = /^\/v1\/checkout\/sessions\/([^/]+)$/.exec(path);
    if (method === 'GET' && sessionMatch?.[1]) {
      const session = this.sessions.get(sessionMatch[1]);
      if (!session || session.account !== account) return notFound();
      return ok(this.sessionObject(session));
    }
    if (method === 'GET' && path === '/v1/charges') {
      const data = [...this.sessions.values()]
        .filter((session) => session.account === account && session.paid)
        .map((session) => ({
          id: `ch_${session.intent}`,
          payment_intent: session.intent,
          amount: session.amount,
          amount_refunded: 0,
          currency: session.currency,
          status: 'succeeded',
          metadata: { contribution_id: session.reference },
          created: Math.floor(Date.now() / 1000),
        }));
      return ok({ data, has_more: false });
    }
    void query;
    return notFound();
  }
}

interface FlutterwavePayment {
  txRef: string;
  amount: string;
  currency: string;
  subaccount: string;
  charge: string;
  id: number | null;
  status: 'pending' | 'successful';
  /** Amount the verification answers, to simulate a tampered notification. */
  verifiedAmount: string | null;
}

interface FlutterwaveChargeback {
  id: number;
  transactionId: number;
  txRef: string;
  flwRef: string;
  amount: string;
  status: 'initiated' | 'declined' | 'accepted' | 'won' | 'lost';
}

/** Reproduces the Flutterwave v3 endpoints used by the adapter, with raw numeric amounts. */
export class FakeFlutterwave extends FakeServer {
  readonly payments = new Map<string, FlutterwavePayment>();
  readonly chargebacks: FlutterwaveChargeback[] = [];
  private sequence = 9000;

  constructor(private readonly secretHash: string) {
    super();
  }

  pay(txRef: string, verifiedAmount: string | null = null): FlutterwavePayment {
    const payment = this.payments.get(txRef);
    if (!payment) throw new Error(`No payment ${txRef}`);
    payment.id = this.sequence += 1;
    payment.status = 'successful';
    payment.verifiedAmount = verifiedAmount;
    return payment;
  }

  /** `charge.completed` with the secret hash in `verif-hash`. */
  webhook(payment: FlutterwavePayment, hash = this.secretHash) {
    const body = `{"event":"charge.completed","data":{"id":${payment.id},"tx_ref":"${payment.txRef}","amount":${payment.amount},"currency":"${payment.currency}","status":"${payment.status}"}}`;
    return { headers: { 'content-type': 'application/json', 'verif-hash': hash }, body };
  }

  /** A chargeback on the whole amount of a paid transaction. */
  chargeback(payment: FlutterwavePayment): FlutterwaveChargeback {
    const chargeback: FlutterwaveChargeback = {
      id: (this.sequence += 1),
      transactionId: payment.id ?? 0,
      txRef: payment.txRef,
      flwRef: `FLW-MOCK-${payment.id}`,
      amount: payment.amount,
      status: 'initiated',
    };
    this.chargebacks.push(chargeback);
    return chargeback;
  }

  /** `chargeback.initiated` as documented: the transaction is named by its `flw_ref` only. */
  chargebackWebhook(chargeback: FlutterwaveChargeback) {
    const body = `{"event":"chargeback.${chargeback.status}","data":{"id":${chargeback.id},"flw_ref":"${chargeback.flwRef}","amount":${chargeback.amount},"status":"${chargeback.status}","stage":"new","comment":"Fraud dispute"}}`;
    return {
      headers: { 'content-type': 'application/json', 'verif-hash': this.secretHash },
      body,
    };
  }

  protected route(method: string, path: string, query: URLSearchParams, body: string) {
    const raw = (data: string) => ({
      status: 200,
      body: `{"status":"success","message":"ok","data":${data}}`,
    });
    if (method === 'POST' && path === '/v3/subaccounts') {
      return raw(`{"id":1,"subaccount_id":"RS_${(this.sequence += 1)}"}`);
    }
    if (method === 'GET' && path === '/v3/transfers/rates') {
      return raw(
        `{"rate":1650.5,"source":{"currency":"${query.get('source_currency')}","amount":1650.5},"destination":{"currency":"EUR","amount":1}}`,
      );
    }
    if (method === 'POST' && path === '/v3/payments') {
      // Amounts are read from the raw body: they must be numeric literals, never strings.
      const amount = /"amount":([0-9.]+)/.exec(body)?.[1] ?? '';
      const charge = /"transaction_charge":([0-9.]+)/.exec(body)?.[1] ?? '';
      const parsed = JSON.parse(body) as {
        tx_ref: string;
        currency: string;
        subaccounts: { id: string }[];
      };
      this.payments.set(parsed.tx_ref, {
        txRef: parsed.tx_ref,
        amount,
        currency: parsed.currency,
        subaccount: parsed.subaccounts[0]?.id ?? '',
        charge,
        id: null,
        status: 'pending',
        verifiedAmount: null,
      });
      return raw(`{"link":"https://checkout.flutterwave.test/${parsed.tx_ref}"}`);
    }
    const verify = /^\/v3\/transactions\/(\d+)\/verify$/.exec(path);
    if (method === 'GET' && verify?.[1]) {
      const payment = [...this.payments.values()].find(
        (candidate) => candidate.id === Number(verify[1]),
      );
      if (!payment) return { status: 404, body: '{"status":"error","message":"not found"}' };
      return raw(
        `{"id":${payment.id},"tx_ref":"${payment.txRef}","flw_ref":"FLW-MOCK-${payment.id}","amount":${payment.verifiedAmount ?? payment.amount},"currency":"${payment.currency}","status":"${payment.status}","app_fee":10.5}`,
      );
    }
    if (method === 'GET' && path === '/v3/chargebacks') {
      const flwRef = query.get('flw_ref');
      const items = this.chargebacks
        .filter((item) => flwRef === null || item.flwRef === flwRef)
        .map(
          (item) =>
            `{"id":${item.id},"amount":${item.amount},"flw_ref":"${item.flwRef}","status":"${item.status}","stage":"new","comment":"Fraud dispute","meta":{"uploaded_proof":null,"history":[]},"due_date":"${new Date().toISOString()}","settlement_id":"NEW","created_at":"${new Date().toISOString()}","transaction_id":${item.transactionId},"tx_ref":"${item.txRef}"}`,
        );
      return {
        status: 200,
        body: `{"status":"success","message":"Chargebacks fetched","meta":{"page_info":{"total":${items.length},"current_page":1,"total_pages":1,"page_size":20}},"data":[${items.join(',')}]}`,
      };
    }
    if (method === 'GET' && path === '/v3/transactions') {
      const items = [...this.payments.values()]
        .filter((payment) => payment.id !== null)
        .map(
          (payment) =>
            `{"id":${payment.id},"tx_ref":"${payment.txRef}","amount":${payment.amount},"currency":"${payment.currency}","status":"${payment.status}","created_at":"${new Date().toISOString()}"}`,
        );
      return {
        status: 200,
        body: `{"status":"success","meta":{"page_info":{"total_pages":1}},"data":[${items.join(',')}]}`,
      };
    }
    return { status: 404, body: '{"status":"error","message":"not found"}' };
  }
}
