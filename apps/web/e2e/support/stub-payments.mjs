// Payments and engagement of the stub api (PROMPT FRONT 5B): the availability of a project and its
// methods, the quote, the contributions of a member and of a project, the off-platform ones, the
// supporters, the coverage, the payout account and its identity check, the engagement dashboard
// and the shared time log. A capture chooses a state with a cookie on localhost
// (`stub_availability`, `stub_payout`), sent to the stub by every request of its context: no
// state shared between parallel captures. Every value is fictitious.

import { STUB_EPOCH, stubIso } from './stub-clock.mjs';

const DAY = 86_400_000;
const NOW = STUB_EPOCH;
const iso = (offsetDays) => new Date(NOW + offsetDays * DAY).toISOString();
const eur = (euros) => ({ amountMinor: String(Math.round(euros * 100)), currency: 'EUR' });
const xof = (francs) => ({ amountMinor: String(francs), currency: 'XOF' });

const PROJECTS = {
  '0192f4a0-3000-7000-8000-666572736f6c': {
    slug: 'ferme-solaire-thies',
    title: 'Ferme solaire coopérative de Thiès',
    availability: 'open',
  },
  '0192f4a0-3000-7000-8000-6b6172697465': {
    slug: 'cooperative-karite-kaolack',
    title: 'Coopérative de karité de Kaolack',
    availability: 'open',
  },
  '0192f4a0-3000-7000-8000-73656368706f': {
    slug: 'sechoirs-mbour',
    title: 'Séchoirs solaires de Mbour',
    availability: 'campaign_closed',
  },
};
const THIES = '0192f4a0-3000-7000-8000-666572736f6c';

/** Countries where the stub offers mobile money, as the simulated rail does (ADR 0052). */
const MOBILE_MONEY_COUNTRIES = ['SN', 'CI', 'CM', 'GH', 'KE'];

const MEMBERS = {
  kofi: {
    handle: 'kofi-mensah',
    displayName: 'Kofi Mensah',
    headline: 'Mentor finance, Accra',
    avatarUrl: null,
  },
  nadia: {
    handle: 'nadia-benali',
    displayName: 'Nadia Benali',
    headline: 'Investisseuse à impact, Paris',
    avatarUrl: null,
  },
  moussa: {
    handle: 'moussa-diop',
    displayName: 'Moussa Diop',
    headline: 'Agronome, Kaolack',
    avatarUrl: null,
  },
  aissatou: {
    handle: 'aissatou-ba',
    displayName: 'Aïssatou Ba',
    headline: 'Fondatrice, Ferme solaire de Thiès',
    avatarUrl: null,
  },
};

function cookieOf(request, name) {
  const cookie = request.headers.cookie ?? '';
  const part = cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

/** EUR equivalent of an amount in XOF at the fixed parity, exact, halves up (ADR 0046). */
function toEur(amount) {
  if (amount.currency === 'EUR') return amount;
  const minor = BigInt(amount.amountMinor) * 100n * 1000n;
  const numerator = minor * 2n + 655_957n;
  return { amountMinor: String(numerator / (655_957n * 2n)), currency: 'EUR' };
}

function methodOption(method, currency, operators = []) {
  const bounds =
    currency === 'XOF' ? { min: xof(656), max: xof(6_559_570) } : { min: eur(1), max: eur(10_000) };
  return { method, operators, ...bounds };
}

function options(projectId, query, request) {
  const project = PROJECTS[projectId];
  const availability = cookieOf(request, 'stub_availability') ?? project?.availability ?? 'open';
  const country = query.get('country') ?? 'SN';
  const currency = query.get('currency');
  const amountMinor = query.get('amountMinor');
  const open = availability === 'open';
  const mobile = MOBILE_MONEY_COUNTRIES.includes(country);
  const currencies = !open
    ? []
    : [
        {
          currency: 'EUR',
          ...methodOption('card', 'EUR'),
          methods: [
            methodOption('card', 'EUR'),
            methodOption('sepa_debit', 'EUR'),
            methodOption('bank_transfer', 'EUR'),
          ],
        },
        ...(mobile
          ? [
              {
                currency: 'XOF',
                ...methodOption('card', 'XOF'),
                methods: [
                  methodOption('card', 'XOF'),
                  methodOption('mobile_money', 'XOF', ['orange_money', 'wave']),
                ],
              },
            ]
          : []),
      ].filter((entry) => !currency || entry.currency === currency);
  const tooHigh = amountMinor !== null && currency === 'EUR' && BigInt(amountMinor) > 1_000_000n;
  const unavailableMethods = !open
    ? []
    : [
        ...(mobile ? [] : [{ method: 'mobile_money', reason: 'contributor_country_not_covered' }]),
        { method: 'paypal', reason: 'not_covered_by_holder_rail' },
        ...(tooHigh ? [{ method: 'card', reason: 'amount_out_of_range' }] : []),
      ];
  return {
    projectId,
    availability,
    rail:
      open || availability === 'holder_not_verified'
        ? { provider: 'simulated', payoutCountry: 'FR', payoutCurrency: 'EUR' }
        : null,
    acceptsPayments: open && currencies.length > 0,
    contributorCountry: country,
    kinds: ['donation', 'reward_crowdfunding', 'love_money'],
    currencies,
    unavailableMethods,
    commissionRateBps: 500,
    anonymousDonations: false,
  };
}

const REWARD_MINIMUMS = {
  '0192f4a0-3600-7000-8000-000000000001': eur(20),
  '0192f4a0-3600-7000-8000-000000000002': eur(60),
  '0192f4a0-3600-7000-8000-000000000003': eur(250),
};

function quote(body) {
  const amount = body.amount;
  const eurEquivalent = toEur(amount);
  const minor = BigInt(amount.amountMinor);
  const commission = (minor * 500n) / 10_000n;
  // Card in euros: 1.5 % + 0.25 EUR, rounded up (published pricing of the rail, ADR 0047).
  const fee =
    amount.currency === 'EUR' && (body.method ?? 'card') === 'card'
      ? (minor * 15n + 999n) / 1000n + 25n
      : null;
  const minimum = body.rewardId ? REWARD_MINIMUMS[body.rewardId] : null;
  return {
    kind: body.kind,
    amount,
    eurEquivalent,
    rate:
      amount.currency === 'XOF'
        ? { unitsPerEur: '655.957', source: 'fixed_parity', at: iso(0) }
        : { unitsPerEur: '1', source: 'identity', at: iso(0) },
    commission: { amountMinor: String(commission), currency: amount.currency },
    commissionRateBps: 500,
    commissionVersion: '2026-10',
    estimatedProviderFee:
      fee === null ? null : { amountMinor: String(fee), currency: amount.currency },
    estimatedHolderAmount:
      fee === null
        ? null
        : { amountMinor: String(minor - commission - fee), currency: amount.currency },
    reward: body.rewardId
      ? {
          rewardId: body.rewardId,
          minAmount: minimum ?? eur(50),
          eligible: BigInt(eurEquivalent.amountMinor) >= BigInt((minimum ?? eur(50)).amountMinor),
        }
      : null,
    methods: [methodOption(body.method ?? 'card', amount.currency)],
  };
}

function contribution(id, status, overrides = {}) {
  const amount = overrides.amount ?? eur(120);
  return {
    id,
    project: {
      id: THIES,
      slug: 'ferme-solaire-thies',
      title: 'Ferme solaire coopérative de Thiès',
    },
    organizationId: null,
    kind: 'reward_crowdfunding',
    status,
    method: 'card',
    amount,
    eurEquivalent: toEur(amount),
    rate: { unitsPerEur: '1', source: 'identity', at: iso(-3) },
    commission: {
      amountMinor: String((BigInt(amount.amountMinor) * 5n) / 100n),
      currency: amount.currency,
    },
    commissionRateBps: 500,
    providerFee: status === 'succeeded' || status === 'partially_refunded' ? eur(2.05) : null,
    refunded:
      status === 'partially_refunded' ? eur(40) : { amountMinor: '0', currency: amount.currency },
    rewardId: '0192f4a0-3600-7000-8000-000000000001',
    rewardState:
      status === 'succeeded' || status === 'partially_refunded'
        ? 'confirmed'
        : status === 'pending_payment'
          ? 'reserved'
          : 'released',
    publicDisplay: true,
    anonymous: false,
    paymentUrl:
      status === 'pending_payment' ? 'https://checkout.stripe.com/c/pay/cs_test_stub' : null,
    // A day after the fixed date of the stub: the page reads the same clock (stub-clock.mjs),
    // so a pending payment stays resumable during the whole run.
    expiresAt: iso(1),
    createdAt: iso(-3),
    succeededAt: status === 'succeeded' || status === 'partially_refunded' ? iso(-3) : null,
    ...overrides,
  };
}

/** The contributions of the demonstration member, one per state the screens show. */
const MINE = [
  contribution('0192f4a0-5000-7000-8000-000000000001', 'pending_payment', { createdAt: iso(0) }),
  contribution('0192f4a0-5000-7000-8000-000000000002', 'succeeded'),
  contribution('0192f4a0-5000-7000-8000-000000000003', 'failed', { createdAt: iso(-1) }),
  contribution('0192f4a0-5000-7000-8000-000000000004', 'pending_payment', {
    expiresAt: iso(-1),
    createdAt: iso(-2),
  }),
  contribution('0192f4a0-5000-7000-8000-000000000005', 'partially_refunded', {
    amount: xof(98_394),
    method: 'mobile_money',
    kind: 'donation',
    rewardId: null,
    rewardState: 'none',
    rate: { unitsPerEur: '655.957', source: 'fixed_parity', at: iso(-20) },
    refunded: xof(19_679),
    providerFee: xof(1_476),
    createdAt: iso(-20),
    succeededAt: iso(-20),
  }),
];

const PROJECT_CONTRIBUTIONS = [
  {
    ...contribution('0192f4a0-5100-7000-8000-000000000001', 'succeeded', { amount: eur(2_400) }),
    contributor: MEMBERS.kofi,
    organization: null,
  },
  {
    ...contribution('0192f4a0-5100-7000-8000-000000000002', 'partially_refunded', {
      amount: eur(500),
      kind: 'donation',
      rewardId: null,
      rewardState: 'none',
    }),
    contributor: MEMBERS.nadia,
    organization: null,
  },
  {
    ...contribution('0192f4a0-5100-7000-8000-000000000003', 'pending_payment', { amount: eur(60) }),
    contributor: MEMBERS.moussa,
    organization: null,
  },
  {
    ...contribution('0192f4a0-5100-7000-8000-000000000004', 'failed', {
      amount: eur(100),
      kind: 'donation',
      rewardId: null,
      rewardState: 'none',
    }),
    contributor: MEMBERS.nadia,
    organization: null,
  },
  {
    ...contribution('0192f4a0-5100-7000-8000-000000000005', 'succeeded', {
      amount: xof(983_935),
      method: 'mobile_money',
      kind: 'donation',
      rewardId: null,
      rewardState: 'none',
      providerFee: xof(14_760),
    }),
    contributor: null,
    anonymous: false,
    organization: {
      id: '0192f4a0-4000-7000-8000-000000000001',
      slug: 'fondation-teranga',
      title: 'Fondation Teranga',
    },
  },
];

function offline(id, kind, status, overrides = {}) {
  return {
    id,
    project: {
      id: THIES,
      slug: 'ferme-solaire-thies',
      title: 'Ferme solaire coopérative de Thiès',
    },
    kind,
    status,
    amount: ['cash', 'institutional_transfer'].includes(kind) ? eur(200) : null,
    eurEquivalent: ['cash', 'institutional_transfer'].includes(kind) ? eur(200) : null,
    declaredBy: 'contributor',
    contributor: MEMBERS.nadia,
    description: 'Remis en main propre lors de la réunion de la coopérative.',
    proofMediaIds: ['0192f4a0-9800-7000-8000-000000000001'],
    createdAt: iso(-2),
    confirmedAt: status === 'declared' ? null : iso(-1),
    decidedAt: status === 'validated' || status === 'rejected' ? iso(-1) : null,
    decisionReason: status === 'rejected' ? 'Nous ne retrouvons pas ce versement.' : null,
    ...overrides,
  };
}

const PROJECT_OFFLINE = [
  offline('0192f4a0-5200-7000-8000-000000000001', 'cash', 'declared'),
  offline('0192f4a0-5200-7000-8000-000000000002', 'institutional_transfer', 'confirmed', {
    contributor: MEMBERS.kofi,
    amount: eur(1_000),
    eurEquivalent: eur(1_000),
  }),
  offline('0192f4a0-5200-7000-8000-000000000003', 'skills_sponsorship', 'rejected', {
    contributor: MEMBERS.moussa,
    proofMediaIds: [],
  }),
];

const MY_OFFLINE = [
  offline('0192f4a0-5200-7000-8000-000000000004', 'love_money_commitment', 'declared', {
    declaredBy: 'holder',
    contributor: MEMBERS.aissatou,
    proofMediaIds: [],
    description: 'Engagement promis lors de la fête du village.',
  }),
  offline('0192f4a0-5200-7000-8000-000000000005', 'cash', 'validated', {
    contributor: MEMBERS.aissatou,
  }),
];

const SUPPORTERS = {
  items: [
    {
      type: 'member',
      displayName: 'Kofi Mensah',
      key: 'kofi-mensah',
      avatarUrl: null,
      kind: 'reward_crowdfunding',
      supportedAt: iso(-12),
    },
    {
      type: 'organization',
      displayName: 'Fondation Teranga',
      key: 'fondation-teranga',
      avatarUrl: null,
      kind: 'donation',
      supportedAt: iso(-8),
    },
    {
      type: 'member',
      displayName: 'Nadia Benali',
      key: 'nadia-benali',
      avatarUrl: null,
      kind: 'donation',
      supportedAt: iso(-3),
    },
  ],
  nextCursor: null,
  contributionCount: 86,
  commitmentCount: 4,
};

const ELIGIBILITY_STRIPE = {
  requirements: [
    { code: 'address_in_payout_country', scope: 'all' },
    { code: 'bank_account_in_payout_country', scope: 'all' },
    { code: 'phone_number', scope: 'all' },
    { code: 'business_website', scope: 'all' },
    { code: 'provider_terms_acceptance', scope: 'all' },
    { code: 'company_registered_in_payout_country', scope: 'company' },
    { code: 'tax_id', scope: 'company' },
  ],
  documents: [
    { code: 'identity_document', scope: 'all' },
    { code: 'passport_if_resident_elsewhere', scope: 'all' },
    { code: 'company_registration_document', scope: 'company' },
  ],
};

const COVERAGE = {
  matrixVersion: '2026-10-10',
  verifiedAt: '2026-10-07',
  commission: { rateBps: 500, version: '2026-10' },
  providers: [
    {
      provider: 'stripe',
      onboarding: 'hosted',
      kycMode: 'provider',
      paymentCurrencyRule: 'payout_currency',
      payoutCountries: ['BE', 'DE', 'ES', 'FR', 'IT', 'NL', 'PT'].map((country) => ({
        country,
        currency: 'EUR',
      })),
      payoutCurrencies: ['EUR'],
      paymentCurrencies: ['EUR'],
      payments: ['card', 'sepa_debit', 'apple_pay', 'google_pay'].map((method) => ({
        currency: 'EUR',
        method,
        operators: [],
        contributorCountries: null,
        min: method === 'card' ? eur(0.5) : null,
        max: null,
      })),
      eligibility: ELIGIBILITY_STRIPE,
    },
    {
      provider: 'flutterwave',
      onboarding: 'bank_details',
      kycMode: 'manual_review',
      paymentCurrencyRule: 'payout_currency',
      payoutCountries: [
        { country: 'GH', currency: 'GHS' },
        { country: 'NG', currency: 'NGN' },
      ],
      payoutCurrencies: ['GHS', 'NGN'],
      paymentCurrencies: ['GHS', 'NGN'],
      payments: [
        {
          currency: 'GHS',
          method: 'card',
          operators: [],
          contributorCountries: null,
          min: null,
          max: null,
        },
        {
          currency: 'GHS',
          method: 'mobile_money',
          operators: ['mtn', 'telecel', 'airteltigo'],
          contributorCountries: ['GH'],
          min: null,
          max: null,
        },
        {
          currency: 'NGN',
          method: 'card',
          operators: [],
          contributorCountries: null,
          min: null,
          max: null,
        },
        {
          currency: 'NGN',
          method: 'ussd',
          operators: [],
          contributorCountries: ['NG'],
          min: null,
          max: null,
        },
      ],
      eligibility: {
        requirements: [
          { code: 'bank_account_in_payout_country', scope: 'all' },
          { code: 'business_name', scope: 'all' },
          { code: 'phone_number', scope: 'all' },
        ],
        documents: [{ code: 'identity_document', scope: 'all' }],
      },
    },
  ],
};

function payoutState(request) {
  return cookieOf(request, 'stub_payout') ?? 'open';
}

function payoutAccount(state) {
  return {
    provider: 'stripe',
    country: 'FR',
    currency: 'EUR',
    status: state === 'open' ? 'active' : 'pending',
    onboarding: 'hosted',
    onboardingUrl: state === 'open' ? null : 'https://connect.stripe.com/setup/s/stub',
    kyc: { mode: 'provider', status: state === 'open' ? 'verified' : 'pending' },
    collectionOpen: state === 'open',
    covered: true,
    changeRefusal: state === 'open' ? 'campaign_in_progress' : null,
    createdAt: iso(-60),
    updatedAt: iso(-1),
  };
}

function kyc(state) {
  if (state === 'none') return { mode: null, status: 'not_submitted', latest: null };
  if (state === 'rejected') {
    return {
      mode: 'manual_review',
      status: 'rejected',
      latest: {
        id: '0192f4a0-5300-7000-8000-000000000001',
        userId: '0192f4a0-0000-7000-8000-000000000001',
        holder: MEMBERS.aissatou,
        status: 'rejected',
        documentMediaIds: [],
        submittedAt: iso(-5),
        decidedAt: iso(-3),
        decisionReason: 'La pièce est illisible : envoyez une photo nette de la pièce entière.',
      },
    };
  }
  return { mode: 'provider', status: state === 'open' ? 'verified' : 'pending', latest: null };
}

const MONTHS = [
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
];
const GIVEN = [0, 50, 0, 120, 0, 0, 300, 80, 0, 2_400, 500, 120];

const DASHBOARD = {
  owner: { type: 'member', id: '0192f4a0-0000-7000-8000-000000000001' },
  givenThisMonth: eur(120),
  givenTotal: eur(3_570),
  givenLastTwelveMonths: eur(3_570),
  projectsSupported: 3,
  minutes: { declared: 330, confirmed: 210, disputed: 60 },
  monthStart: '2026-10-01T00:00:00.000Z',
  monthly: MONTHS.map((month, index) => ({ month, given: eur(GIVEN[index]) })),
};

function timeEntry(id, status, overrides = {}) {
  return {
    id,
    contributor: MEMBERS.kofi,
    project: {
      id: THIES,
      slug: 'ferme-solaire-thies',
      title: 'Ferme solaire coopérative de Thiès',
    },
    entrepreneur: null,
    kind: 'mentoring',
    minutes: 120,
    date: '2026-10-04',
    description: 'Revue du modèle de location-vente des kits et des échéances.',
    status,
    respondedAt: status === 'declared' ? null : iso(-2),
    disputeReason: status === 'disputed' ? 'Cette séance a eu lieu une autre semaine.' : null,
    createdAt: iso(-5),
    ...overrides,
  };
}

const RECEIVED = [
  timeEntry('0192f4a0-5400-7000-8000-000000000001', 'declared'),
  timeEntry('0192f4a0-5400-7000-8000-000000000002', 'confirmed', {
    contributor: MEMBERS.nadia,
    kind: 'expertise',
    minutes: 90,
  }),
];
const DECLARED = [
  timeEntry('0192f4a0-5400-7000-8000-000000000003', 'confirmed', {
    contributor: MEMBERS.aissatou,
    project: null,
    entrepreneur: MEMBERS.moussa,
    minutes: 210,
  }),
  timeEntry('0192f4a0-5400-7000-8000-000000000004', 'disputed', {
    contributor: MEMBERS.aissatou,
    project: null,
    entrepreneur: MEMBERS.kofi,
    kind: 'expertise',
    minutes: 60,
  }),
];

const page = (items) => ({ items, nextCursor: null });

export function paymentRoutes({ sessionOf, problem, readJson, state }) {
  const log = (route, email, extra = {}) =>
    state().writes.push({ route, email, ...extra, at: stubIso() });

  return async function paymentsRoute(request, path, url) {
    const method = request.method;
    const signedIn = () => sessionOf(request);
    if (method === 'GET' && path === '/v1/public/payments/coverage') {
      return { status: 200, body: COVERAGE };
    }
    const supporters = /^\/v1\/public\/projects\/([\w-]+)\/supporters$/.exec(path);
    if (method === 'GET' && supporters) return { status: 200, body: SUPPORTERS };
    // The other routes are a member's: without a session, the stub answers 404 as for any route.
    const email = signedIn();
    if (!email) return null;
    const optionsPath = /^\/v1\/projects\/([\w-]+)\/payment-options$/.exec(path);
    if (method === 'GET' && optionsPath) {
      return { status: 200, body: options(optionsPath[1], url.searchParams, request) };
    }
    const quotePath = /^\/v1\/projects\/([\w-]+)\/contribution-quotes$/.exec(path);
    if (method === 'POST' && quotePath) {
      const body = await readJson(request);
      if (body.amount.currency === 'EUR' && BigInt(body.amount.amountMinor) > 1_000_000n) {
        const refusal = problem(422, 'PAYMENTS_AMOUNT_OUT_OF_RANGE');
        return { ...refusal, body: { ...refusal.body, reason: 'amount_out_of_range' } };
      }
      return { status: 200, body: quote(body) };
    }
    const create = /^\/v1\/(projects|organizations)\/([\w-]+)\/contributions$/.exec(path);
    if (method === 'POST' && create) {
      const body = await readJson(request);
      const key = request.headers['idempotency-key'];
      log('contribution', email, { key, amount: body.amount });
      return {
        status: 201,
        body: contribution('0192f4a0-5000-7000-8000-0000000000aa', 'pending_payment', {
          amount: body.amount,
          paymentUrl: `${url.origin}/__test/checkout`,
        }),
      };
    }
    if (method === 'GET' && path === '/v1/me/contributions') {
      const status = url.searchParams.get('status');
      // The pending payment proposed again on the project only when the capture asks for it.
      const pending = cookieOf(request, 'stub_pending') === '1';
      const items = MINE.filter(
        (item) => (!status || item.status === status) && (pending || status !== 'pending_payment'),
      );
      return { status: 200, body: page(items) };
    }
    const one = /^\/v1\/me\/contributions\/([\w-]+)(\/return|\/cancel)?$/.exec(path);
    if (one && (method === 'GET' || method === 'POST')) {
      const item = MINE.find((candidate) => candidate.id === one[1]);
      if (!item) return problem(404, 'PAYMENTS_CONTRIBUTION_NOT_FOUND');
      return { status: 200, body: one[2] === '/cancel' ? { ...item, status: 'canceled' } : item };
    }
    const ofProject = /^\/v1\/projects\/([\w-]+)\/contributions$/.exec(path);
    if (method === 'GET' && ofProject) {
      const status = url.searchParams.get('status');
      const kind = url.searchParams.get('kind');
      return {
        status: 200,
        body: page(
          PROJECT_CONTRIBUTIONS.filter(
            (item) => (!status || item.status === status) && (!kind || item.kind === kind),
          ),
        ),
      };
    }
    if (method === 'GET' && /^\/v1\/projects\/[\w-]+\/contributions\/export$/.test(path)) {
      return {
        status: 200,
        raw: 'type,date,amount\nonline,2026-10-07,2400.00\n',
        headers: { 'content-type': 'text/csv' },
      };
    }
    const offlinePath = /^\/v1\/projects\/([\w-]+)\/offline-contributions$/.exec(path);
    if (method === 'GET' && offlinePath) {
      const status = url.searchParams.get('status');
      return {
        status: 200,
        body: page(PROJECT_OFFLINE.filter((item) => !status || item.status === status)),
      };
    }
    if (method === 'GET' && path === '/v1/me/offline-contributions') {
      return { status: 200, body: page(MY_OFFLINE) };
    }
    if (method === 'GET' && path === '/v1/me/payout-account') {
      const payout = payoutState(request);
      return payout === 'none' || payout === 'rejected'
        ? problem(404, 'PAYMENTS_PAYOUT_ACCOUNT_NOT_FOUND')
        : { status: 200, body: payoutAccount(payout) };
    }
    if (method === 'GET' && path === '/v1/me/kyc') {
      return { status: 200, body: kyc(payoutState(request)) };
    }
    if (method === 'GET' && path === '/v1/me/impact-dashboard')
      return { status: 200, body: DASHBOARD };
    if (method === 'GET' && /^\/v1\/organizations\/[\w-]+\/impact-dashboard$/.test(path)) {
      return {
        status: 200,
        body: {
          ...DASHBOARD,
          owner: { type: 'organization', id: '0192f4a0-4000-7000-8000-000000000001' },
        },
      };
    }
    if (method === 'GET' && path === '/v1/me/time-entries')
      return { status: 200, body: page(DECLARED) };
    if (method === 'GET' && path === '/v1/me/time-entries/received')
      return { status: 200, body: page(RECEIVED) };
    return null;
  };
}

/** What the holder of the demonstration still misses before collecting, by state of the capture. */
export function collectionMissing(request) {
  const availability = cookieOf(request, 'stub_availability');
  if (availability === 'holder_not_verified') return ['kyc_verified'];
  if (availability === 'holder_without_covered_payout_account') return ['payout_account'];
  return [];
}
