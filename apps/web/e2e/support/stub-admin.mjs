// Stub of the console of the administration (PROMPT FRONT 9A): the answers its screens read, by
// account (stub-api.mjs), with filled queues. Fictitious data, like the rest of the stub; the
// rules live in the api, here only the states the screens draw. A sensitive write answers
// ACCESS_REAUTHENTICATION_REQUIRED with the `stub-stale=1` cookie, as the api for an old session.

import { STUB_EPOCH, stubIso } from './stub-clock.mjs';

const ID = (n) => `0192f4a0-9000-7000-8000-${String(n).padStart(12, '0')}`;
const DAY = 86_400_000;
const NOW = STUB_EPOCH;
const at = (days) => new Date(NOW + days * DAY).toISOString();
const eur = (amountMinor) => ({ amountMinor: String(amountMinor), currency: 'EUR' });

/** Privileged actions of the console with their roles and their recent session (ADR 0172). */
const POLICIES = {
  'access.roles.read': [['admin'], false],
  'access.roles.manage': [['admin'], true],
  'impact.methodology.manage': [['admin'], false],
  'organization.verification.review': [['moderator', 'admin'], false],
  'payment.offline.validate': [['admin'], false],
  'payment.kyc.review': [['admin'], false],
  'payment.refund': [['admin'], true],
  'payment.contributions.read': [['admin'], false],
  'payment.reconciliation.manage': [['admin'], false],
  'trust.moderation.read': [['moderator', 'admin'], false],
  'trust.moderation.assign': [['moderator', 'admin'], false],
  'trust.moderation.decide': [['moderator', 'admin'], false],
  'trust.appeal.resolve': [['moderator', 'admin'], false],
  'trust.suspension.lift': [['moderator', 'admin'], false],
  'trust.project.refund': [['admin'], true],
  'trust.project.freeze': [['admin'], true],
  'trust.suspension.permanent': [['admin'], true],
  'trust.transparency.read': [['admin'], false],
  'privacy.requests.read': [['admin'], false],
  'localization.manage': [['admin'], false],
  'admin.members.read': [['admin'], false],
  'admin.flags.read': [['admin'], false],
  'admin.flags.manage': [['admin'], true],
  'admin.highlights.manage': [['moderator', 'admin'], false],
  'admin.jobs.read': [['admin'], false],
  'admin.jobs.retry': [['admin'], true],
  'admin.stats.read': [['admin'], false],
  'admin.audit.read': [['admin'], false],
  'admin.audit.export': [['admin'], false],
  'admin.console.read': [['moderator', 'admin'], false],
  'admin.sessions.revoke': [['admin'], false],
};

/** The members the console names: the staff of the demonstration and the members concerned. */
const PEOPLE = {
  koffi: { userId: ID(3), name: 'Koffi Agbodjan', handle: 'koffi-agbodjan' },
  claudine: { userId: ID(4), name: 'Claudine Pierre-Louis', handle: 'claudine-pierre-louis' },
  jeanBaptiste: { userId: ID(5), name: 'Jean-Baptiste Kouassi', handle: 'jean-baptiste-kouassi' },
  thierry: { userId: ID(6), name: 'Thierry Lacroix', handle: 'thierry-lacroix' },
  rodrigue: { userId: ID(7), name: 'Rodrigue Mbemba', handle: 'rodrigue-mbemba' },
  aissatou: { userId: ID(2), name: 'Aïssatou Ba', handle: 'aissatou-ba' },
  moussa: { userId: ID(1), name: 'Moussa Diop', handle: 'moussa-diop' },
};
const STAFF_BY_EMAIL = {
  'koffi.agbodjan@demo.pitchorium.test': PEOPLE.koffi,
  'claudine.pierre.louis@demo.pitchorium.test': PEOPLE.claudine,
};

const card = (person) => ({
  handle: person.handle,
  displayName: person.name,
  headline: null,
  avatarUrl: null,
});

function freshCases() {
  return [
    {
      id: ID(801),
      targetType: 'post',
      targetId: ID(901),
      subjectId: PEOPLE.thierry.userId,
      origin: 'report',
      signalKind: null,
      status: 'open',
      priority: 3,
      priorityReasons: ['several_reports', 'harassment'],
      reportCount: 3,
      reasons: ['spam', 'harassment'],
      assignedTo: null,
      decisionId: null,
      createdAt: at(-2),
      updatedAt: at(-1),
      resolvedAt: null,
      subject: PEOPLE.thierry,
      target: {
        type: 'post',
        key: ID(901),
        parentKey: null,
        label: null,
        excerpt:
          'Offre exceptionnelle : écrivez-moi en privé pour un accompagnement garanti, places limitées, paiement direct.',
        moderationStatus: 'visible',
      },
      reports: [
        {
          id: ID(811),
          reason: 'spam',
          details: 'La même offre revient chaque jour dans mon fil.',
          reporterId: PEOPLE.aissatou.userId,
          anonymous: false,
          messageContext: null,
          createdAt: at(-2),
        },
        {
          id: ID(812),
          reason: 'spam',
          details: null,
          reporterId: PEOPLE.moussa.userId,
          anonymous: false,
          messageContext: null,
          createdAt: at(-1.5),
        },
        {
          id: ID(813),
          reason: 'harassment',
          details: 'Relances insistantes en commentaire après un refus.',
          reporterId: null,
          anonymous: true,
          messageContext: null,
          createdAt: at(-1),
        },
      ],
    },
    {
      id: ID(802),
      targetType: 'message',
      targetId: ID(902),
      subjectId: PEOPLE.rodrigue.userId,
      origin: 'report',
      signalKind: null,
      status: 'open',
      priority: 2,
      priorityReasons: ['harassment'],
      reportCount: 1,
      reasons: ['harassment'],
      assignedTo: PEOPLE.koffi.userId,
      decisionId: null,
      createdAt: at(-0.5),
      updatedAt: at(-0.4),
      resolvedAt: null,
      subject: PEOPLE.rodrigue,
      target: {
        type: 'message',
        key: ID(902),
        parentKey: null,
        label: null,
        excerpt: null,
        moderationStatus: 'visible',
      },
      reports: [
        {
          id: ID(814),
          reason: 'harassment',
          details: 'Messages répétés après que j’ai décliné sa proposition.',
          reporterId: PEOPLE.aissatou.userId,
          anonymous: false,
          messageContext: {
            conversationId: ID(950),
            messages: [
              {
                id: ID(951),
                senderId: PEOPLE.rodrigue.userId,
                sentAt: at(-0.7),
                text: 'Vous avez vu ma proposition d’investissement ?',
                reported: false,
              },
              {
                id: ID(952),
                senderId: PEOPLE.aissatou.userId,
                sentAt: at(-0.65),
                text: 'Merci, ce n’est pas pour nous.',
                reported: false,
              },
              {
                id: ID(902),
                senderId: PEOPLE.rodrigue.userId,
                sentAt: at(-0.6),
                text: 'Répondez-moi aujourd’hui, sinon je contacte vos partenaires.',
                reported: true,
              },
            ],
          },
          createdAt: at(-0.5),
        },
      ],
    },
    {
      id: ID(803),
      targetType: 'project',
      targetId: ID(903),
      subjectId: PEOPLE.jeanBaptiste.userId,
      origin: 'signal',
      signalKind: 'reports_received',
      status: 'open',
      priority: 5,
      priorityReasons: ['fraud', 'campaign_in_funding'],
      reportCount: 2,
      reasons: ['fraud', 'misleading_information'],
      assignedTo: null,
      decisionId: null,
      createdAt: at(-6),
      updatedAt: at(-3),
      resolvedAt: null,
      subject: PEOPLE.jeanBaptiste,
      target: {
        type: 'project',
        key: 'sechoir-solaire-soubre',
        parentKey: null,
        label: 'Séchoir solaire de Soubré',
        excerpt: null,
        moderationStatus: 'visible',
      },
      reports: [
        {
          id: ID(815),
          reason: 'fraud',
          details: 'Les photos du séchoir viennent d’un autre projet publié en 2024.',
          reporterId: PEOPLE.moussa.userId,
          anonymous: false,
          messageContext: null,
          createdAt: at(-6),
        },
        {
          id: ID(816),
          reason: 'misleading_information',
          details: null,
          reporterId: null,
          anonymous: true,
          messageContext: null,
          createdAt: at(-4),
        },
      ],
    },
  ];
}

/** Two pending appeals: one decided by Koffi, one by Claudine (never reviewed by its author). */
function freshAppeals() {
  return [
    {
      id: ID(701),
      caseId: ID(721),
      targetType: 'post',
      targetId: ID(904),
      kind: 'hide',
      reason: 'misleading_information',
      statement:
        'La publication présente un rendement garanti de 30 % sans aucune source ; elle est masquée jusqu’à sa correction.',
      ground: 'terms',
      groundReference: 'Conditions d’utilisation, informations trompeuses',
      automatedDetection: false,
      suspensionEndsAt: null,
      decidedAt: at(-5),
      appealableUntil: at(178),
      subjectId: PEOPLE.jeanBaptiste.userId,
      decidedBy: PEOPLE.koffi.userId,
      appealReviewerId: null,
      appeal: {
        id: ID(731),
        decisionId: ID(701),
        statement: 'Le chiffre vient du rapport annuel de la coopérative, que j’ai ajouté en lien.',
        status: 'pending',
        outcomeStatement: null,
        createdAt: at(-3),
        resolvedAt: null,
      },
      people: [PEOPLE.jeanBaptiste, PEOPLE.koffi],
    },
    {
      id: ID(702),
      caseId: ID(722),
      targetType: 'profile',
      targetId: PEOPLE.thierry.userId,
      kind: 'warn',
      reason: 'spam',
      statement:
        'Des invitations identiques ont été envoyées à plus de cinquante membres en une journée.',
      ground: 'terms',
      groundReference: null,
      automatedDetection: true,
      suspensionEndsAt: null,
      decidedAt: at(-9),
      appealableUntil: at(174),
      subjectId: PEOPLE.thierry.userId,
      decidedBy: PEOPLE.claudine.userId,
      appealReviewerId: null,
      appeal: {
        id: ID(732),
        decisionId: ID(702),
        statement: 'Ces invitations suivaient un salon où nous avions échangé nos cartes.',
        status: 'pending',
        outcomeStatement: null,
        createdAt: at(-7),
        resolvedAt: null,
      },
      people: [PEOPLE.thierry, PEOPLE.claudine],
    },
  ];
}

function freshVerifications() {
  return [
    {
      id: ID(601),
      organization: {
        id: ID(611),
        slug: 'diaspora-invest-caraibes',
        name: 'Diaspora Invest Caraïbes',
        websiteUrl: 'https://diaspora-invest.example',
        verificationStatus: 'pending',
      },
      requestedBy: PEOPLE.thierry.userId,
      requester: { name: PEOPLE.thierry.name },
      declaration:
        'Association loi 1901 enregistrée en Guadeloupe, active depuis 2019 auprès des porteurs de projets de la diaspora.',
      documentMediaIds: [ID(621), ID(622)],
      signals: { websiteDomain: 'diaspora-invest.example', memberEmailOnWebsiteDomain: true },
      status: 'pending',
      criteriaMet: [],
      decisionReason: null,
      decidedBy: null,
      createdAt: at(-4),
      decidedAt: null,
    },
    {
      id: ID(602),
      organization: {
        id: ID(612),
        slug: 'fondation-teranga',
        name: 'Fondation Teranga',
        websiteUrl: 'https://teranga.example',
        verificationStatus: 'verified',
      },
      requestedBy: PEOPLE.aissatou.userId,
      requester: { name: PEOPLE.aissatou.name },
      declaration: 'Fondation reconnue d’utilité publique au Sénégal.',
      documentMediaIds: [ID(623)],
      signals: { websiteDomain: 'teranga.example', memberEmailOnWebsiteDomain: true },
      status: 'approved',
      criteriaMet: [],
      decisionReason: 'Statuts et récépissé conformes, site au même nom.',
      decidedBy: PEOPLE.claudine.userId,
      createdAt: at(-40),
      decidedAt: at(-38),
    },
  ];
}

const RATE = { unitsPerEur: '1', source: 'identity', at: at(-12) };

function contribution(n, overrides) {
  return {
    id: ID(n),
    project: { id: ID(903), slug: 'sechoir-solaire-soubre', title: 'Séchoir solaire de Soubré' },
    organizationId: null,
    kind: 'donation',
    status: 'succeeded',
    method: 'card',
    amount: eur(10_000),
    eurEquivalent: eur(10_000),
    rate: RATE,
    commission: eur(500),
    commissionRateBps: 500,
    providerFee: eur(165),
    refunded: eur(0),
    rewardId: null,
    rewardState: 'none',
    publicDisplay: true,
    anonymous: false,
    paymentUrl: null,
    expiresAt: at(-11),
    createdAt: at(-12),
    succeededAt: at(-12),
    contributor: card(PEOPLE.moussa),
    organization: null,
    ...overrides,
  };
}

function freshContributions() {
  return [
    contribution(501, {}),
    contribution(502, {
      kind: 'reward_crowdfunding',
      method: 'mobile_money',
      amount: { amountMinor: '327979', currency: 'XOF' },
      eurEquivalent: eur(50_000),
      rate: { unitsPerEur: '655.957', source: 'fixed_parity', at: at(-20) },
      commission: { amountMinor: '16399', currency: 'XOF' },
      providerFee: null,
      refunded: { amountMinor: '0', currency: 'XOF' },
      rewardState: 'confirmed',
      createdAt: at(-20),
      succeededAt: at(-20),
      contributor: card(PEOPLE.aissatou),
    }),
    contribution(503, {
      status: 'partially_refunded',
      amount: eur(500_000),
      eurEquivalent: eur(500_000),
      commission: eur(20_000),
      refunded: eur(100_000),
      createdAt: at(-30),
      succeededAt: at(-30),
      contributor: card(PEOPLE.jeanBaptiste),
    }),
  ];
}

function ledgerOf(item) {
  const minor = BigInt(item.amount.amountMinor);
  const commission = BigInt(item.commission.amountMinor);
  const signed = (value) => ({ amountMinor: String(value), currency: item.amount.currency });
  return [
    {
      id: ID(Number(item.id.slice(-3)) + 4000),
      kind: 'payment_succeeded',
      occurredAt: item.succeededAt ?? item.createdAt,
      lines: [
        { account: 'contributor_funds', amount: signed(-minor) },
        { account: 'holder_share', amount: signed(minor - commission) },
        { account: 'platform_commission', amount: signed(commission) },
        {
          account: 'funding_sources',
          amount: { ...item.eurEquivalent, amountMinor: `-${item.eurEquivalent.amountMinor}` },
        },
        { account: 'project_funding', amount: item.eurEquivalent },
      ],
    },
  ];
}

function freshMethodologies() {
  const level = (criterion, key, value, fr, en) => ({
    key,
    labelKey: `impactAuthored.${criterion}.${key}`,
    labels: en ? { fr, en } : { fr },
    value,
  });
  const criterion = (key, weight, fr, en, withEnglish = true) => ({
    key,
    labelKey: `impactAuthored.${key}.label`,
    descriptionKey: `impactAuthored.${key}.description`,
    labels: withEnglish ? { fr, en } : { fr },
    descriptions: withEnglish
      ? { fr: `${fr} : ce que le porteur déclare.`, en: `${en}: what the holder declares.` }
      : { fr: `${fr} : ce que le porteur déclare.` },
    weight,
    scale: [
      level(key, 'none', 0, 'Aucun', withEnglish ? 'None' : null),
      level(key, 'some', 50, 'En partie', withEnglish ? 'In part' : null),
      level(key, 'full', 100, 'Pleinement', withEnglish ? 'Fully' : null),
    ],
  });
  const published = [
    criterion('jobs', 3, 'Emplois locaux', 'Local jobs'),
    criterion('women', 2, 'Femmes dirigeantes', 'Women leaders'),
    criterion('climate', 2, 'Climat', 'Climate'),
  ];
  return [
    {
      id: ID(401),
      version: 2,
      name: 'DEMO v2, brouillon non contractuel',
      status: 'draft',
      demo: true,
      criteria: [...published, criterion('water', 1, 'Accès à l’eau', 'Water access', false)],
      createdAt: at(-2),
      publishedAt: null,
      archivedAt: null,
    },
    {
      id: ID(402),
      version: 1,
      name: 'DEMO v1, non contractuelle',
      status: 'published',
      demo: true,
      criteria: published,
      createdAt: at(-60),
      publishedAt: at(-58),
      archivedAt: null,
    },
  ];
}

/** Labels an active language still lacks, as the api checks them (French and English active). */
function coverageOf(methodology) {
  const locales = ['fr', 'en'];
  const missing = [];
  for (const criterion of methodology.criteria) {
    for (const locale of locales) {
      if (!criterion.labels?.[locale]) {
        missing.push({ criterionKey: criterion.key, levelKey: null, field: 'label', locale });
      }
      if (!criterion.descriptions?.[locale]) {
        missing.push({ criterionKey: criterion.key, levelKey: null, field: 'description', locale });
      }
      for (const level of criterion.scale) {
        if (!level.labels?.[locale]) {
          missing.push({
            criterionKey: criterion.key,
            levelKey: level.key,
            field: 'label',
            locale,
          });
        }
      }
    }
  }
  return { ...methodology, labelCoverage: { locales, missing } };
}

function freshFlags() {
  const locale = (code, total, missingCount, review, reviewedBy) => ({
    key: `locale.${code}`,
    enabled: false,
    description: `Langue ${code} de l’interface`,
    updatedAt: at(-30),
    legalReference: null,
    guard: {
      kind: 'locale',
      status: {
        locale: code,
        enabled: false,
        catalog: { total, missing: missingCount, complete: missingCount === 0 },
        review: { status: review, reviewedBy, reviewedAt: reviewedBy ? at(-3) : null },
        activatable: missingCount === 0 && review === 'reviewed' && Boolean(reviewedBy),
      },
    },
  });
  return [
    locale('sw', 4210, 3120, 'empty', null),
    locale('wo', 4210, 0, 'pending-review', null),
    locale('ln', 4210, 4210, 'empty', null),
    {
      key: 'funding.equity',
      enabled: false,
      description: 'Prise de participation (equity), après validation juridique',
      updatedAt: at(-90),
      legalReference: null,
      guard: { kind: 'legal', legalReferenceRequired: true, onlinePaymentAvailable: false },
    },
    {
      key: 'funding.loans',
      enabled: false,
      description: 'Prêts, après validation juridique',
      updatedAt: at(-90),
      legalReference: null,
      guard: { kind: 'legal', legalReferenceRequired: true, onlinePaymentAvailable: false },
    },
    {
      key: 'discovery.events',
      enabled: true,
      description: 'Événements dans la découverte',
      updatedAt: at(-14),
      legalReference: null,
      guard: null,
    },
  ];
}

function freshHighlights() {
  return [
    {
      targetType: 'project',
      targetId: ID(903),
      featuredAt: at(-1),
      label: 'Séchoir solaire de Soubré',
      position: 1,
    },
    {
      targetType: 'project',
      targetId: ID(905),
      featuredAt: at(-8),
      label: 'Pompes solaires de Thiès',
      position: 2,
    },
    {
      targetType: 'profile',
      targetId: 'aissatou-ba',
      featuredAt: at(-3),
      label: 'Aïssatou Ba',
      position: 1,
    },
    {
      targetType: 'post',
      targetId: ID(906),
      featuredAt: at(-2),
      label: 'Retour sur le forum de Jacmel : trois rencontres, deux partenariats.',
      position: 1,
    },
  ];
}

function freshJobs() {
  return [
    {
      queue: 'trust.moderation',
      id: 'demo-refund-of-a-missing-contribution',
      name: 'refund',
      attemptsMade: 1,
      failedReason: 'Contribution not found',
      failedAt: at(-0.3),
      data: { contributionId: ID(999), reason: '[redacted]' },
    },
    {
      queue: 'notifications.email',
      id: 'digest-0192f4a0',
      name: 'send-digest',
      attemptsMade: 5,
      failedReason: 'SMTP 421 [redacted]',
      failedAt: at(-1.2),
      data: { userId: PEOPLE.aissatou.userId, email: '[redacted]', items: 12 },
    },
  ];
}

function freshAudit() {
  const entry = (n, days, actor, action, targetType, targetId, metadata = {}) => ({
    id: ID(n),
    actorType: actor ? 'user' : 'system',
    actorId: actor?.userId ?? null,
    action,
    targetType,
    targetId,
    metadata,
    requestId: actor ? `req-${n}` : null,
    occurredAt: at(days),
  });
  return [
    entry(301, -0.1, PEOPLE.claudine, 'admin.member-viewed', 'user', PEOPLE.moussa.userId),
    entry(302, -0.4, PEOPLE.koffi, 'trust.case-assigned', 'moderation_case', ID(802), {
      moderatorId: PEOPLE.koffi.userId,
    }),
    entry(303, -1, PEOPLE.claudine, 'payments.refund-requested', 'contribution', ID(503), {
      amount: '1000.00 EUR',
    }),
    entry(304, -2, null, 'payments.reconciliation-run', 'reconciliation_run', ID(310), {
      discrepancies: 1,
    }),
    entry(305, -5, PEOPLE.koffi, 'trust.decision-taken', 'moderation_decision', ID(701), {
      kind: 'hide',
    }),
  ];
}

function freshRights() {
  return [
    {
      id: ID(201),
      kind: 'export',
      userId: PEOPLE.aissatou.userId,
      status: 'ready',
      requestedAt: at(-0.2),
      dueAt: at(30),
      completedAt: at(-0.19),
      answered: true,
      overdue: false,
      detail: null,
    },
    {
      id: ID(202),
      kind: 'erasure',
      userId: PEOPLE.moussa.userId,
      status: 'scheduled',
      requestedAt: at(-3),
      dueAt: at(28),
      completedAt: null,
      answered: false,
      overdue: false,
      detail: null,
    },
    {
      id: ID(203),
      kind: 'erasure',
      userId: PEOPLE.thierry.userId,
      status: 'blocked',
      requestedAt: at(-35),
      dueAt: at(-4),
      completedAt: null,
      answered: false,
      overdue: true,
      detail: 'PRIVACY_SOLE_OWNER',
    },
  ];
}

function fresh() {
  return {
    cases: freshCases(),
    appeals: freshAppeals(),
    verifications: freshVerifications(),
    contributions: freshContributions(),
    refunds: {},
    kyc: [
      {
        id: ID(101),
        userId: PEOPLE.moussa.userId,
        holder: card(PEOPLE.moussa),
        status: 'pending',
        documentMediaIds: [ID(111), ID(112)],
        submittedAt: at(-1),
        decidedAt: null,
        decisionReason: null,
      },
    ],
    offline: [
      {
        id: ID(121),
        project: {
          id: ID(903),
          slug: 'sechoir-solaire-soubre',
          title: 'Séchoir solaire de Soubré',
        },
        kind: 'institutional_transfer',
        status: 'confirmed',
        amount: eur(250_000),
        eurEquivalent: eur(250_000),
        declaredBy: 'holder',
        contributor: card(PEOPLE.thierry),
        description: 'Virement de la mairie de Soubré, convention de février.',
        proofMediaIds: [ID(131)],
        createdAt: at(-6),
        confirmedAt: at(-5),
        decidedAt: null,
        decisionReason: null,
      },
    ],
    discrepancies: [
      {
        id: ID(141),
        kind: 'amount_mismatch',
        provider: 'simulated',
        reference: 'sim_pi_demo_amount_mismatch',
        contributionId: ID(501),
        projectId: ID(903),
        expected: '5000 EUR',
        actual: '4500 EUR',
        status: 'open',
        detectedAt: at(-1),
        resolvedAt: null,
        resolution: null,
      },
    ],
    methodologies: freshMethodologies(),
    flags: freshFlags(),
    flagChanges: {
      'discovery.events': [
        {
          enabled: true,
          legalReference: null,
          changedBy: { userId: PEOPLE.claudine.userId, name: PEOPLE.claudine.name },
          changedAt: at(-14),
        },
        { enabled: false, legalReference: null, changedBy: null, changedAt: at(-60) },
      ],
    },
    highlights: freshHighlights(),
    jobs: freshJobs(),
    audit: freshAudit(),
    rights: freshRights(),
  };
}

const page = (items) => ({ items, nextCursor: null });

export function adminRoutes({ accounts, twoFactorOf, sessionOf, problem, readJson, state }) {
  const own = () => (state().admin ??= fresh());
  const log = (route, email, extra = {}) =>
    state().writes.push({ route, email, ...extra, at: stubIso() });

  return async (request, path, url) => {
    if (!path.startsWith('/v1/admin/') && !/^\/v1\/media\/[\w-]+\/download-url$/.test(path)) {
      return undefined;
    }
    const email = sessionOf(request);
    if (!email) return problem(401, 'UNAUTHENTICATED');
    const account = accounts[email];
    const roles = account.roles;
    const staff = STAFF_BY_EMAIL[email];
    const holds = (action) => {
      const policy = POLICIES[action];
      return Boolean(
        policy && twoFactorOf(email, request) && policy[0].some((role) => roles.includes(role)),
      );
    };
    const stale = request.headers.cookie?.includes('stub-stale=1');
    const guard = (action) => {
      if (!holds(action)) return problem(403, 'FORBIDDEN');
      if (POLICIES[action][1] && stale) return problem(403, 'ACCESS_REAUTHENTICATION_REQUIRED');
      return null;
    };
    const method = request.method;
    const data = own();
    const query = url.searchParams;

    if (method === 'GET' && /^\/v1\/media\/[\w-]+\/download-url$/.test(path)) {
      return {
        status: 200,
        body: { url: `${url.origin}/files/export.zip`, expiresAt: stubIso(300_000) },
      };
    }

    if (method === 'GET' && path === '/v1/admin/capabilities') {
      return {
        status: 200,
        body: {
          roles,
          actions: Object.entries(POLICIES).map(([action, [, recent]]) => ({
            action,
            allowed: holds(action),
            code: holds(action) ? null : 'FORBIDDEN',
            recentAuthentication: recent,
          })),
          reauthenticationMaxAgeMinutes: 15,
        },
      };
    }

    if (method === 'GET' && path === '/v1/admin/queues') {
      const counts = {
        moderation_cases: [
          data.cases.filter((item) => item.status === 'open').length,
          'trust.moderation.read',
        ],
        appeals: [
          data.appeals.filter((item) => item.appeal.status === 'pending').length,
          'trust.moderation.read',
        ],
        organization_verifications: [
          data.verifications.filter((item) => item.status === 'pending').length,
          'organization.verification.review',
        ],
        kyc_reviews: [
          data.kyc.filter((item) => item.status === 'pending').length,
          'payment.kyc.review',
        ],
        offline_contributions: [
          data.offline.filter((item) => item.status === 'confirmed').length,
          'payment.offline.validate',
        ],
        discrepancies: [
          data.discrepancies.filter((item) => item.status === 'open').length,
          'payment.reconciliation.manage',
        ],
        failed_jobs: [data.jobs.length, 'admin.jobs.read'],
        rights_requests: [
          data.rights.filter((item) => !item.answered).length,
          'privacy.requests.read',
        ],
      };
      return {
        status: 200,
        body: {
          items: Object.entries(counts)
            .filter(([, [, action]]) => holds(action))
            .map(([queue, [count]]) => ({ queue, count })),
        },
      };
    }

    if (method === 'GET' && path === '/v1/admin/stats') {
      const refused = guard('admin.stats.read');
      if (refused) return refused;
      return {
        status: 200,
        body: {
          members: { total: 64, active30Days: 41 },
          projects: { draft: 3, funding: 4, funded: 2, closed: 1 },
          contributions: { succeeded: 38, collectedEurMinor: '1834500' },
          pending: {
            moderationCases: data.cases.filter((item) => item.status === 'open').length,
            appeals: data.appeals.filter((item) => item.appeal.status === 'pending').length,
            kycReviews: data.kyc.filter((item) => item.status === 'pending').length,
            offlineContributions: data.offline.filter((item) => item.status === 'confirmed').length,
            rightsRequests: data.rights.filter((item) => !item.answered).length,
            failedJobs: data.jobs.length,
            organizationVerifications: data.verifications.filter(
              (item) => item.status === 'pending',
            ).length,
            discrepancies: data.discrepancies.filter((item) => item.status === 'open').length,
          },
        },
      };
    }

    // Moderation.
    if (path.startsWith('/v1/admin/moderation/')) {
      const refused = guard('trust.moderation.read');
      if (refused) return refused;
      const admin = roles.includes('admin');
      const view = ({ target: _target, reports: _reports, ...item }) => item;
      if (method === 'GET' && path === '/v1/admin/moderation/cases') {
        const status = query.get('status') ?? 'open';
        const assigned = query.get('assigned') ?? 'any';
        const targetType = query.get('targetType');
        const reason = query.get('reason');
        const before = query.get('openedBefore');
        const items = data.cases
          .filter((item) => item.status === status)
          .filter((item) =>
            assigned === 'me'
              ? item.assignedTo === staff?.userId
              : assigned === 'unassigned'
                ? item.assignedTo === null
                : true,
          )
          .filter((item) => !targetType || item.targetType === targetType)
          .filter((item) => !reason || item.reasons.includes(reason))
          .filter((item) => !before || item.createdAt < before)
          .sort((a, b) => b.priority - a.priority)
          .map(view);
        return { status: 200, body: page(items) };
      }
      if (method === 'GET' && path === '/v1/admin/moderation/moderators') {
        return { status: 200, body: { items: [PEOPLE.koffi, PEOPLE.claudine] } };
      }
      if (method === 'GET' && path === '/v1/admin/moderation/appeals') {
        const items = data.appeals
          .filter((item) => item.appeal.status === 'pending')
          .map((item) => {
            const own = item.decidedBy === staff?.userId;
            return { ...item, resolvable: !own, refusal: own ? 'TRUST_SAME_MODERATOR' : null };
          });
        return { status: 200, body: page(items) };
      }
      if (method === 'GET' && path === '/v1/admin/moderation/transparency') {
        const refusedReport = guard('trust.transparency.read');
        if (refusedReport) return refusedReport;
        return {
          status: 200,
          body: {
            from: query.get('from'),
            to: query.get('to'),
            reports: {
              total: 24,
              anonymous: 5,
              byReason: { spam: 11, harassment: 6, fraud: 3, misleading_information: 3, other: 1 },
              byTargetType: { post: 13, message: 5, profile: 3, project: 2, comment: 1 },
            },
            cases: { opened: 17, fromSignals: 3, resolved: 14, medianResolutionHours: 19.5 },
            decisions: { byKind: { dismiss: 6, hide: 4, remove: 1, warn: 2, suspend: 1 } },
            suspensions: { started: 1, permanent: 0 },
            appeals: { received: 4, upheld: 1, overturned: 1, pending: 2 },
          },
        };
      }
      const detailOf = (found) => {
        const kinds = ['dismiss', 'hide', 'remove', 'warn', 'suspend', 'freeze_project'].map(
          (kind) => {
            const applicable =
              kind === 'dismiss' ||
              (['hide', 'remove'].includes(kind) && found.targetType !== 'profile') ||
              (['warn', 'suspend'].includes(kind) && found.subjectId !== null) ||
              (kind === 'freeze_project' && found.targetType === 'project');
            const code = !applicable
              ? 'TRUST_DECISION_NOT_APPLICABLE'
              : kind === 'freeze_project' && !admin
                ? 'TRUST_ADMIN_REQUIRED'
                : null;
            return {
              kind,
              allowed: code === null,
              code,
              recentAuthentication: kind === 'freeze_project',
            };
          },
        );
        const reporters = found.reports
          .map((report) =>
            Object.values(PEOPLE).find((person) => person.userId === report.reporterId),
          )
          .filter(Boolean);
        return {
          status: 200,
          body: {
            ...view(found),
            reports: found.reports,
            assignments: found.assignedTo
              ? [
                  {
                    moderatorId: found.assignedTo,
                    assignedBy: found.assignedTo,
                    assignedAt: found.updatedAt,
                  },
                ]
              : [],
            decisions: [],
            target: found.target,
            people: [found.subject, ...reporters, PEOPLE.koffi, PEOPLE.claudine].filter(
              (person, index, all) =>
                person && all.findIndex((other) => other?.userId === person.userId) === index,
            ),
            decisionOptions: {
              kinds,
              suspension: found.subjectId ? { maxDays: admin ? 365 : 30, permanent: admin } : null,
            },
          },
        };
      };
      const detail = /^\/v1\/admin\/moderation\/cases\/([\w-]+)$/.exec(path);
      if (method === 'GET' && detail) {
        const found = data.cases.find((item) => item.id === detail[1]);
        return found ? detailOf(found) : problem(404, 'TRUST_CASE_NOT_FOUND');
      }
      const assign = /^\/v1\/admin\/moderation\/cases\/([\w-]+)\/assignment$/.exec(path);
      if (method === 'POST' && assign) {
        const body = await readJson(request);
        const found = data.cases.find((item) => item.id === assign[1]);
        if (!found) return problem(404, 'TRUST_CASE_NOT_FOUND');
        found.assignedTo = body.moderatorId;
        log('case-assign', email, { case: found.id, moderator: body.moderatorId });
        return detailOf(found);
      }
      const decide = /^\/v1\/admin\/moderation\/cases\/([\w-]+)\/decisions$/.exec(path);
      if (method === 'POST' && decide) {
        const body = await readJson(request);
        const found = data.cases.find((item) => item.id === decide[1]);
        if (!found) return problem(404, 'TRUST_CASE_NOT_FOUND');
        const sensitive =
          body.kind === 'freeze_project'
            ? 'trust.project.freeze'
            : body.kind === 'suspend' && body.suspensionDays === null
              ? 'trust.suspension.permanent'
              : null;
        if (sensitive) {
          const refusedSensitive = guard(sensitive);
          if (refusedSensitive) return refusedSensitive;
        }
        found.status = 'resolved';
        found.resolvedAt = stubIso();
        const decision = {
          id: ID(760 + data.cases.indexOf(found)),
          caseId: found.id,
          targetType: found.targetType,
          targetId: found.targetId,
          kind: body.kind,
          reason: body.reason ?? null,
          statement: body.statement,
          ground: body.ground,
          groundReference: body.groundReference ?? null,
          automatedDetection: found.origin === 'signal',
          suspensionEndsAt: null,
          decidedAt: stubIso(),
          appealableUntil: at(183),
          appeal: null,
          subjectId: found.subjectId,
          decidedBy: staff?.userId ?? ID(3),
          appealReviewerId: null,
        };
        found.decisionId = decision.id;
        log('case-decide', email, { case: found.id, kind: body.kind });
        return { status: 201, body: decision };
      }
      const resolve = /^\/v1\/admin\/moderation\/appeals\/([\w-]+)\/resolution$/.exec(path);
      if (method === 'POST' && resolve) {
        const body = await readJson(request);
        const found = data.appeals.find((item) => item.appeal.id === resolve[1]);
        if (!found) return problem(404, 'TRUST_APPEAL_NOT_FOUND');
        if (found.decidedBy === staff?.userId) return problem(409, 'TRUST_SAME_MODERATOR');
        found.appeal = {
          ...found.appeal,
          status: body.outcome,
          outcomeStatement: body.statement,
          resolvedAt: stubIso(),
        };
        found.appealReviewerId = staff?.userId ?? null;
        log('appeal-resolve', email, { appeal: found.appeal.id, outcome: body.outcome });
        const { people: _people, ...decision } = found;
        return { status: 200, body: decision };
      }
      return undefined;
    }

    // Verification of the organisations.
    if (path.startsWith('/v1/admin/organizations/')) {
      const refused = guard('organization.verification.review');
      if (refused) return refused;
      if (method === 'GET' && path === '/v1/admin/organizations/verification-requests') {
        const status = query.get('status') ?? 'pending';
        return {
          status: 200,
          body: {
            items: data.verifications.filter((item) => item.status === status),
            criteria: [],
          },
        };
      }
      const one = /^\/v1\/admin\/organizations\/verification-requests\/([\w-]+)$/.exec(path);
      if (method === 'GET' && one) {
        const found = data.verifications.find((item) => item.id === one[1]);
        return found
          ? { status: 200, body: found }
          : problem(404, 'ORGANIZATIONS_VERIFICATION_NOT_FOUND');
      }
      const decide = /^\/v1\/admin\/organizations\/verification-requests\/([\w-]+)\/decision$/.exec(
        path,
      );
      if (method === 'POST' && decide) {
        const body = await readJson(request);
        const found = data.verifications.find((item) => item.id === decide[1]);
        if (!found) return problem(404, 'ORGANIZATIONS_VERIFICATION_NOT_FOUND');
        found.status = body.decision;
        found.decisionReason = body.reason;
        found.criteriaMet = body.criteriaMet ?? [];
        found.decidedAt = stubIso();
        found.organization.verificationStatus =
          body.decision === 'approved' ? 'verified' : 'rejected';
        log('verification-decide', email, { request: found.id, decision: body.decision });
        return { status: 200, body: found };
      }
      const revoke = /^\/v1\/admin\/organizations\/([\w-]+)\/verification-revocation$/.exec(path);
      if (method === 'POST' && revoke) {
        const found = data.verifications.find((item) => item.organization.id === revoke[1]);
        if (found) found.organization.verificationStatus = 'unverified';
        log('verification-revoke', email, { organization: revoke[1] });
        return { status: 204 };
      }
      return undefined;
    }

    // Payments.
    if (path.startsWith('/v1/admin/payments/')) {
      if (method === 'GET' && path === '/v1/admin/payments/contributions') {
        const refused = guard('payment.contributions.read');
        if (refused) return refused;
        const q = query.get('q');
        const status = query.get('status');
        const items = data.contributions
          .filter((item) => !status || item.status === status)
          .filter(
            (item) => !q || item.id === q || item.contributor?.handle === q.replace(/^@/, ''),
          );
        return { status: 200, body: page(items) };
      }
      const one =
        /^\/v1\/admin\/payments\/contributions\/([\w-]+)(\/refund-preview|\/refunds)?$/.exec(path);
      if (one) {
        const found = data.contributions.find((item) => item.id === one[1]);
        if (!found) return problem(404, 'PAYMENTS_CONTRIBUTION_NOT_FOUND');
        const remaining = BigInt(found.amount.amountMinor) - BigInt(found.refunded.amountMinor);
        const money = (minor) => ({ amountMinor: String(minor), currency: found.amount.currency });
        const effectOf = (body) => {
          const minor = body.amount ? BigInt(body.amount.amountMinor) : remaining;
          const full = minor === remaining;
          const commission =
            (BigInt(found.commission.amountMinor) * minor) / BigInt(found.amount.amountMinor);
          const euros =
            (BigInt(found.eurEquivalent.amountMinor) * minor) / BigInt(found.amount.amountMinor);
          return { minor, full, commission, euros };
        };
        if (method === 'GET' && !one[2]) {
          const refused = guard('payment.contributions.read');
          if (refused) return refused;
          return {
            status: 200,
            body: {
              ...found,
              refundable: remaining > 0n ? money(remaining) : null,
              refunds: data.refunds[found.id] ?? [],
              ledger: ledgerOf(found),
            },
          };
        }
        if (method === 'POST' && one[2] === '/refund-preview') {
          const refused = guard('payment.contributions.read');
          if (refused) return refused;
          const body = await readJson(request);
          const effect = effectOf(body);
          if (effect.minor <= 0n || effect.minor > remaining)
            return problem(409, 'PAYMENTS_REFUND_INVALID');
          return {
            status: 200,
            body: {
              amount: money(effect.minor),
              refundable: money(remaining),
              full: effect.full,
              statusAfter: effect.full ? 'refunded' : 'partially_refunded',
              commissionRefunded: money(effect.commission),
              fundingReversed: eur(effect.euros),
              project: {
                collected: eur(1_250_000),
                collectedAfter: eur(1_250_000 - Number(effect.euros)),
              },
              rewardReleased: effect.full && found.rewardState !== 'none',
            },
          };
        }
        if (method === 'POST' && one[2] === '/refunds') {
          const refused = guard('payment.refund');
          if (refused) return refused;
          const body = await readJson(request);
          const effect = effectOf(body);
          if (effect.minor <= 0n || effect.minor > remaining)
            return problem(409, 'PAYMENTS_REFUND_INVALID');
          const refund = {
            id: ID(170 + (data.refunds[found.id]?.length ?? 0)),
            contributionId: found.id,
            amount: money(effect.minor),
            commissionRefunded: money(effect.commission),
            status: 'succeeded',
            reason: body.reason,
            createdAt: stubIso(),
          };
          (data.refunds[found.id] ??= []).unshift(refund);
          found.refunded = money(BigInt(found.refunded.amountMinor) + effect.minor);
          found.status = effect.full ? 'refunded' : 'partially_refunded';
          log('refund', email, {
            contribution: found.id,
            amount: refund.amount.amountMinor,
            key: request.headers['idempotency-key'],
          });
          return { status: 201, body: refund };
        }
      }
      if (path.startsWith('/v1/admin/payments/kyc-submissions')) {
        const refused = guard('payment.kyc.review');
        if (refused) return refused;
        if (method === 'GET' && path === '/v1/admin/payments/kyc-submissions') {
          const status = query.get('status');
          return {
            status: 200,
            body: page(data.kyc.filter((item) => !status || item.status === status)),
          };
        }
        const kyc = /^\/v1\/admin\/payments\/kyc-submissions\/([\w-]+)(\/decision)?$/.exec(path);
        const found = kyc && data.kyc.find((item) => item.id === kyc[1]);
        if (!found) return problem(404, 'PAYMENTS_KYC_NOT_FOUND');
        if (method === 'GET' && !kyc[2]) return { status: 200, body: found };
        if (method === 'POST' && kyc[2]) {
          const body = await readJson(request);
          Object.assign(found, {
            status: body.decision,
            decisionReason: body.reason,
            decidedAt: stubIso(),
          });
          log('kyc-decide', email, { submission: found.id, decision: body.decision });
          return { status: 200, body: found };
        }
      }
      if (path.startsWith('/v1/admin/payments/offline-contributions')) {
        const refused = guard('payment.offline.validate');
        if (refused) return refused;
        if (method === 'GET' && path === '/v1/admin/payments/offline-contributions') {
          const status = query.get('status');
          return {
            status: 200,
            body: page(data.offline.filter((item) => !status || item.status === status)),
          };
        }
        const decide = /^\/v1\/admin\/payments\/offline-contributions\/([\w-]+)\/decision$/.exec(
          path,
        );
        const found = decide && data.offline.find((item) => item.id === decide[1]);
        if (method === 'POST' && found) {
          const body = await readJson(request);
          Object.assign(found, {
            status: body.decision,
            decisionReason: body.reason,
            decidedAt: stubIso(),
          });
          log('offline-decide', email, { offline: found.id, decision: body.decision });
          return { status: 200, body: found };
        }
      }
      if (
        path.startsWith('/v1/admin/payments/discrepancies') ||
        path === '/v1/admin/payments/reconciliation-runs'
      ) {
        const refused = guard('payment.reconciliation.manage');
        if (refused) return refused;
        if (method === 'GET' && path === '/v1/admin/payments/discrepancies') {
          const status = query.get('status');
          return {
            status: 200,
            body: page(data.discrepancies.filter((item) => !status || item.status === status)),
          };
        }
        const resolve = /^\/v1\/admin\/payments\/discrepancies\/([\w-]+)\/resolve$/.exec(path);
        const found = resolve && data.discrepancies.find((item) => item.id === resolve[1]);
        if (method === 'POST' && found) {
          const body = await readJson(request);
          Object.assign(found, {
            status: 'resolved',
            resolvedAt: stubIso(),
            resolution: body.note,
          });
          log('discrepancy-resolve', email, { discrepancy: found.id });
          return { status: 200, body: found };
        }
        if (method === 'POST' && path === '/v1/admin/payments/reconciliation-runs') {
          log('reconcile', email);
          return {
            status: 201,
            body: { runId: ID(311), checkedTransactions: 38, discrepancies: [] },
          };
        }
      }
      return undefined;
    }

    // Impact methodologies.
    if (path.startsWith('/v1/admin/impact/methodologies')) {
      const refused = guard('impact.methodology.manage');
      if (refused) return refused;
      if (method === 'GET' && path === '/v1/admin/impact/methodologies') {
        return { status: 200, body: { items: data.methodologies.map(coverageOf) } };
      }
      if (method === 'POST' && path === '/v1/admin/impact/methodologies') {
        const body = await readJson(request);
        const created = {
          id: ID(403 + data.methodologies.length),
          version: Math.max(...data.methodologies.map((item) => item.version)) + 1,
          name: body.name,
          status: 'draft',
          demo: false,
          criteria: body.criteria,
          createdAt: stubIso(),
          publishedAt: null,
          archivedAt: null,
        };
        data.methodologies.unshift(created);
        log('methodology-create', email, { methodology: created.id });
        return { status: 201, body: coverageOf(created) };
      }
      const one =
        /^\/v1\/admin\/impact\/methodologies\/([\w-]+)(\/publish|\/archive|\/preview)?$/.exec(path);
      const found = one && data.methodologies.find((item) => item.id === one[1]);
      if (!found) return problem(404, 'IMPACT_METHODOLOGY_NOT_FOUND');
      if (method === 'GET' && !one[2]) return { status: 200, body: coverageOf(found) };
      if (method === 'PUT' && !one[2]) {
        const body = await readJson(request);
        Object.assign(found, { name: body.name, criteria: body.criteria });
        log('methodology-update', email, { methodology: found.id });
        return { status: 200, body: coverageOf(found) };
      }
      if (method === 'DELETE' && !one[2]) {
        data.methodologies = data.methodologies.filter((item) => item !== found);
        log('methodology-delete', email, { methodology: found.id });
        return { status: 204 };
      }
      if (method === 'POST' && one[2] === '/publish') {
        if (coverageOf(found).labelCoverage.missing.length > 0)
          return problem(409, 'IMPACT_LABELS_MISSING');
        for (const item of data.methodologies) {
          if (item.status === 'published')
            Object.assign(item, { status: 'archived', archivedAt: stubIso() });
        }
        Object.assign(found, { status: 'published', publishedAt: stubIso() });
        log('methodology-publish', email, { methodology: found.id });
        return { status: 200, body: coverageOf(found) };
      }
      if (method === 'POST' && one[2] === '/archive') {
        Object.assign(found, { status: 'archived', archivedAt: stubIso() });
        log('methodology-archive', email, { methodology: found.id });
        return { status: 200, body: coverageOf(found) };
      }
      if (method === 'POST' && one[2] === '/preview') {
        const body = await readJson(request);
        const total = found.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
        const details = found.criteria.map((criterion) => {
          const answer =
            criterion.scale.find((level) => level.key === body.answers[criterion.key]) ??
            criterion.scale[0];
          const maxValue = Math.max(...criterion.scale.map((level) => level.value));
          return {
            criterionKey: criterion.key,
            labelKey: criterion.labelKey,
            descriptionKey: criterion.descriptionKey,
            labels: criterion.labels,
            descriptions: criterion.descriptions,
            weight: criterion.weight,
            answerKey: answer.key,
            answerLabelKey: answer.labelKey,
            answerLabels: answer.labels,
            value: answer.value,
            maxValue,
          };
        });
        const score = Math.round(
          details.reduce(
            (sum, detail) => sum + (detail.weight * detail.value) / detail.maxValue,
            0,
          ) *
            (100 / total),
        );
        const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'emerging';
        return { status: 200, body: { score, level, details } };
      }
      return undefined;
    }

    // Members (the file of a member) and their roles.
    const memberPath =
      /^\/v1\/admin\/members\/([\w-]+)(\/sessions\/revocation|\/roles(?:\/(\w+))?)?$/.exec(path);
    if (method === 'GET' && path === '/v1/admin/members') {
      const refused = guard('admin.members.read');
      if (refused) return refused;
      const q = (query.get('q') ?? '').toLowerCase();
      const items = Object.entries(accounts)
        .filter(([address, item]) => address.includes(q) || item.name.toLowerCase().includes(q))
        .map(([address, item], index) => ({
          userId:
            Object.values(PEOPLE).find((person) => person.handle === item.handle)?.userId ??
            ID(50 + index),
          email: address,
          name: item.name,
          handle: item.handle,
          roles: item.roles,
          emailVerified: item.emailVerified,
          createdAt: at(-200 + index),
        }));
      return { status: 200, body: page(items) };
    }
    if (memberPath) {
      const person = Object.values(PEOPLE).find((item) => item.userId === memberPath[1]);
      if (!person) return problem(404, 'ADMIN_MEMBER_NOT_FOUND');
      const entry = Object.entries(accounts).find(([, item]) => item.handle === person.handle);
      const memberRoles = (data.roles ??= {})[person.userId] ?? entry?.[1].roles ?? ['member'];
      if (method === 'GET' && !memberPath[2]) {
        const refused = guard('admin.members.read');
        if (refused) return refused;
        return {
          status: 200,
          body: {
            userId: person.userId,
            email: entry?.[0] ?? `${person.handle.replaceAll('-', '.')}@demo.pitchorium.test`,
            name: person.name,
            handle: person.handle,
            roles: memberRoles,
            emailVerified: true,
            createdAt: at(-200),
            locale: 'fr',
            timeZone: 'Africa/Dakar',
            twoFactorEnabled: entry?.[1].twoFactorEnabled ?? false,
            legal: { termsVersion: '2026-09', privacyVersion: '2026-09' },
            suspension: null,
            kycVerified: false,
            sessions: [
              {
                id: 'session-1',
                userAgent:
                  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
                createdAt: at(-3),
                lastActiveAt: at(-0.1),
                expiresAt: at(27),
              },
              {
                id: 'session-2',
                userAgent:
                  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36',
                createdAt: at(-10),
                lastActiveAt: at(-2),
                expiresAt: at(20),
              },
            ],
            decisions: [],
            contributions: data.contributions
              .filter((item) => item.contributor?.handle === person.handle)
              .map((item) => ({
                id: item.id,
                project: item.project,
                kind: item.kind,
                status: item.status,
                amount: item.amount,
                createdAt: item.createdAt,
              })),
          },
        };
      }
      if (method === 'POST' && memberPath[2] === '/sessions/revocation') {
        const refused = guard('admin.sessions.revoke');
        if (refused) return refused;
        log('sessions-revoke', email, { user: person.userId });
        return { status: 204 };
      }
      if (memberPath[2]?.startsWith('/roles')) {
        const refused = guard('access.roles.manage');
        if (refused) return refused;
        const role = method === 'POST' ? (await readJson(request)).role : memberPath[3];
        const next =
          method === 'POST'
            ? [...new Set([...memberRoles, role])]
            : memberRoles.filter((item) => item !== role);
        data.roles[person.userId] = next;
        log(method === 'POST' ? 'role-grant' : 'role-revoke', email, { user: person.userId, role });
        return {
          status: 200,
          body: {
            userId: person.userId,
            assignments: next
              .filter((item) => item !== 'member')
              .map((item) => ({
                role: item,
                grantedAt: stubIso(),
                grantedBy: staff?.userId ?? null,
              })),
          },
        };
      }
    }

    // Flags, highlights, failed jobs, audit log, rights requests.
    if (method === 'GET' && path === '/v1/admin/feature-flags') {
      const refused = guard('admin.flags.read');
      if (refused) return refused;
      return { status: 200, body: { items: data.flags } };
    }
    const flag = /^\/v1\/admin\/feature-flags\/([\w.-]+)(\/history)?$/.exec(path);
    if (flag) {
      const found = data.flags.find((item) => item.key === flag[1]);
      if (!found) return problem(404, 'ADMIN_FLAG_NOT_FOUND');
      if (method === 'GET' && flag[2]) {
        const refused = guard('admin.flags.read');
        if (refused) return refused;
        return { status: 200, body: { items: data.flagChanges[found.key] ?? [] } };
      }
      if (method === 'PATCH' && !flag[2]) {
        const refused = guard('admin.flags.manage');
        if (refused) return refused;
        const body = await readJson(request);
        if (body.enabled && found.guard?.kind === 'locale' && !found.guard.status.activatable) {
          return problem(409, 'LOCALIZATION_LOCALE_NOT_READY');
        }
        if (body.enabled && found.guard?.kind === 'legal' && !body.legalReference) {
          return problem(409, 'ADMIN_LEGAL_REFERENCE_REQUIRED');
        }
        Object.assign(found, {
          enabled: body.enabled,
          legalReference: body.legalReference ?? found.legalReference,
          updatedAt: stubIso(),
        });
        (data.flagChanges[found.key] ??= []).unshift({
          enabled: body.enabled,
          legalReference: body.legalReference ?? null,
          changedBy: staff ? { userId: staff.userId, name: staff.name } : null,
          changedAt: stubIso(),
        });
        log('flag', email, { key: found.key, enabled: body.enabled });
        return { status: 200, body: found };
      }
    }
    if (method === 'GET' && path === '/v1/admin/highlights') {
      const refused = guard('admin.highlights.manage');
      if (refused) return refused;
      const type = query.get('targetType');
      const items = data.highlights
        .filter((item) => !type || item.targetType === type)
        .sort((a, b) =>
          a.targetType === b.targetType
            ? a.position - b.position
            : a.targetType.localeCompare(b.targetType),
        );
      return { status: 200, body: { items } };
    }
    const highlight = /^\/v1\/admin\/highlights\/(post|project|profile)\/([\w-]+)$/.exec(path);
    if (highlight) {
      const refused = guard('admin.highlights.manage');
      if (refused) return refused;
      const [, targetType, targetId] = highlight;
      const others = data.highlights.filter(
        (item) => !(item.targetType === targetType && item.targetId === targetId),
      );
      const existing = data.highlights.find(
        (item) => item.targetType === targetType && item.targetId === targetId,
      );
      if (method === 'PUT') {
        const sameType = others.filter((item) => item.targetType === targetType);
        sameType.forEach((item, index) => (item.position = index + 2));
        data.highlights = [
          {
            targetType,
            targetId,
            featuredAt: stubIso(),
            label: existing?.label ?? targetId,
            position: 1,
          },
          ...others,
        ];
        log('highlight', email, { target: `${targetType}:${targetId}` });
        return { status: 204 };
      }
      if (method === 'DELETE') {
        others
          .filter((item) => item.targetType === targetType)
          .forEach((item, index) => (item.position = index + 1));
        data.highlights = others;
        log('unhighlight', email, { target: `${targetType}:${targetId}` });
        return { status: 204 };
      }
    }
    if (method === 'GET' && path === '/v1/admin/jobs/failed') {
      const refused = guard('admin.jobs.read');
      if (refused) return refused;
      const queue = query.get('queue');
      return {
        status: 200,
        body: { items: data.jobs.filter((item) => !queue || item.queue === queue) },
      };
    }
    const retry = /^\/v1\/admin\/jobs\/([\w.-]+)\/([\w-]+)\/retry$/.exec(path);
    if (method === 'POST' && retry) {
      const refused = guard('admin.jobs.retry');
      if (refused) return refused;
      const found = data.jobs.find((item) => item.queue === retry[1] && item.id === retry[2]);
      data.jobs = data.jobs.filter((item) => item !== found);
      log('job-retry', email, {
        job: `${retry[1]}:${retry[2]}`,
        key: request.headers['idempotency-key'],
      });
      return {
        status: 200,
        body: { queue: retry[1], id: retry[2], outcome: found ? 'retried' : 'not_failed' },
      };
    }
    if (method === 'GET' && path === '/v1/admin/audit-log') {
      const refused = guard('admin.audit.read');
      if (refused) return refused;
      const action = query.get('action');
      return {
        status: 200,
        body: page(data.audit.filter((item) => !action || item.action.includes(action))),
      };
    }
    if (method === 'GET' && path === '/v1/admin/audit-log/export') {
      const refused = guard('admin.audit.export');
      if (refused) return refused;
      log('audit-export', email);
      const rows = data.audit.map((item) =>
        [
          item.occurredAt,
          item.actorType,
          item.actorId ?? '',
          item.action,
          item.targetType,
          item.targetId,
        ].join(','),
      );
      return {
        status: 200,
        raw: ['occurredAt,actorType,actorId,action,targetType,targetId', ...rows].join('\r\n'),
        headers: { 'content-type': 'text/csv; charset=utf-8' },
      };
    }
    if (method === 'GET' && path === '/v1/admin/privacy/requests') {
      const refused = guard('privacy.requests.read');
      if (refused) return refused;
      const kind = query.get('kind');
      return { status: 200, body: page(data.rights.filter((item) => !kind || item.kind === kind)) };
    }
    return undefined;
  };
}
