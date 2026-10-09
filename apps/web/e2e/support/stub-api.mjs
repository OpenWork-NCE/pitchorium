// Stand-in for the api during the end-to-end tests of the web app: the routes the pages read,
// with the CORS headers of the real api. Sessions are created by the sign-in route of Better
// Auth with the demonstration accounts of `pnpm db:seed:dev` (frontend handoff); a real Socket.IO
// server pushes the events the tests ask for. Anything else answers an RFC 9457 404.
//
// Test routes (`/__test/*`): emit a realtime event, read the log of the writes, reset the state.
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { contentRoutes } from './stub-content.mjs';

const port = Number(process.env.STUB_API_PORT ?? 3299);
const origin = process.env.STUB_WEB_ORIGIN ?? 'http://localhost:3201';
const SESSION_COOKIE = 'pitchorium.session_token';
const DEMO_PASSWORD = 'pitchorium-demo-2026';

/** Accounts of the demonstration data, each in the state a test needs. */
const ACCOUNTS = {
  'aissatou.ba@demo.pitchorium.test': {
    name: 'Aïssatou Ba',
    handle: 'aissatou-ba',
    headline: 'Fondatrice, Ferme solaire de Thiès',
    roles: ['member'],
    emailVerified: true,
    legalUpToDate: true,
    suspended: false,
    twoFactorEnabled: false,
    // The public page is open: visitors and search engines read it (ADR 0101).
    publicPage: true,
  },
  'kofi.mensah@demo.pitchorium.test': {
    name: 'Kofi Mensah',
    handle: 'kofi-mensah',
    headline: 'Mentor finance, Accra',
    roles: ['member'],
    emailVerified: false,
    legalUpToDate: false,
    suspended: false,
    twoFactorEnabled: false,
  },
  'claudine.pierre.louis@demo.pitchorium.test': {
    name: 'Claudine Pierre-Louis',
    handle: 'claudine-pierre-louis',
    headline: 'Modératrice',
    roles: ['member', 'moderator'],
    emailVerified: true,
    legalUpToDate: true,
    suspended: false,
    twoFactorEnabled: false,
  },
  'koffi.agbodjan@demo.pitchorium.test': {
    name: 'Koffi Agbodjan',
    handle: 'koffi-agbodjan',
    headline: 'Modérateur',
    roles: ['member', 'moderator'],
    emailVerified: true,
    legalUpToDate: true,
    suspended: false,
    // A privileged role works with a second factor only (ADR 0015): the console opens.
    twoFactorEnabled: true,
  },
  'moussa.diop@demo.pitchorium.test': {
    name: 'Moussa Diop',
    handle: 'moussa-diop',
    headline: 'Agronome, Kaolack',
    roles: ['member'],
    emailVerified: true,
    legalUpToDate: true,
    suspended: true,
    twoFactorEnabled: false,
  },
};

const INITIAL_COUNTERS = {
  notifications: 3,
  messages: { unread: 2, conversations: 1 },
  messageRequests: 0,
  invitations: { connections: 1, introductions: 0, projects: 0, organizations: 0 },
};

/** Authors of the feed of the stub: demonstration members, fictitious like their posts. */
const AUTHORS = [
  {
    handle: 'kofi-mensah',
    displayName: 'Kofi Mensah',
    headline: 'Mentor finance, Accra',
    avatarUrl: null,
  },
  {
    handle: 'nadia-benali',
    displayName: 'Nadia Benali',
    headline: 'Investisseuse à impact, Paris',
    avatarUrl: null,
  },
  {
    handle: 'moussa-diop',
    displayName: 'Moussa Diop',
    headline: 'Agronome, Kaolack',
    avatarUrl: null,
  },
];

/** People suggested, with reasons written with the keys of the discovery namespace. */
const SUGGESTIONS = [
  ['ifeoma-okafor', 'Ifeoma Okafor', 'Designer produit, Lagos', 'reasons.mentoring_available'],
  [
    'jean-baptiste-pierre-louis',
    'Jean-Baptiste Pierre-Louis',
    'Ingénieur agronome',
    'reasons.mentoring_available',
  ],
  ['amina-sow', 'Amina Sow', 'Mentore, Dakar', 'reasons.mentoring_available'],
  ['fatou-sall', 'Fatou Sall', 'Entrepreneure, Thiès', 'reasons.mentoring_available'],
].map(([key, title, subtitle, reason]) => ({
  candidate: {
    kind: 'person',
    key,
    title,
    subtitle,
    imageUrl: null,
    countryCodes: ['SN'],
    sectorCodes: [],
    facets: { entrepreneur: false, contributor: true },
    hats: [],
  },
  score: 40,
  // As the api: the reasons carry codes only, never the name shown above them.
  sentence: { key: 'sentences.one', clauses: [{ key: reason, params: {} }] },
  reasons: [],
  rulesVersion: 1,
}));

/**
 * Projects of the stub: a published one, public; a draft, shown to its team only (here, any
 * member): a visitor gets 404 at the same address (ADR 0101).
 */
const PROJECTS = {
  'ferme-solaire-thies': { title: 'Ferme solaire coopérative de Thiès', public: true },
  'projet-en-preparation': { title: 'Séchoirs solaires de Podor', public: false },
};

function projectOf(slug) {
  const project = PROJECTS[slug];
  return {
    id: `0192f4a0-3000-7000-8000-${Buffer.from(slug).toString('hex').slice(0, 12)}`,
    slug,
    title: project.title,
    summary: null,
    status: project.public ? 'funding' : 'draft',
  };
}

/** The profile of an account as the api gives it to a reader (privacy applied). */
function profileOf(account) {
  const entrepreneur =
    account.handle === 'aissatou-ba'
      ? {
          companyName: 'Ferme solaire de Thiès',
          sectorCode: 'energy',
          stageCode: 'early_revenue',
          companyCountryCode: 'SN',
          companyCity: 'Thiès',
          teamSize: 12,
          foundedYear: 2021,
          pitch:
            'Des séchoirs et des pompes solaires en location pour les coopératives maraîchères.',
          needs: ['funding', 'mentoring'],
          soughtExpertise: ['Financement de la transition énergétique'],
          fundingTarget: null,
        }
      : null;
  return {
    handle: account.handle,
    displayName: account.name,
    headline: account.headline,
    bio: 'Je construis des solutions solaires pour les coopératives agricoles du Sénégal.',
    countryCode: 'SN',
    city: 'Thiès',
    languages: ['fr', 'wo'],
    links: { website: 'https://example.org', linkedin: null },
    avatarUrl: null,
    avatarMediaId: null,
    coverUrl: null,
    coverMediaId: null,
    facets: { entrepreneur: entrepreneur !== null, contributor: false },
    entrepreneur,
    entrepreneurImpact: null,
    contributor: null,
    contributorOrganization: null,
  };
}

/** The profile of its owner: the same, with its settings and its strength. */
function ownProfileOf(email) {
  const account = ACCOUNTS[email];
  return {
    ...profileOf(account),
    userId: currentUser(email).user.id,
    intention: 'carry_project',
    visibility: {
      publicPageEnabled: account.publicPage,
      entrepreneurDetails: 'members',
      contributorDetails: 'members',
      networkLists: 'members',
    },
    strength: { level: 'intermediate', percent: 60, missing: ['avatar', 'cover', 'facet'] },
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  };
}

const RELATIONSHIP = {
  degree: 'second',
  mutualConnections: { count: 3, capped: false },
  connection: 'none',
  requestId: null,
  following: false,
  followedBy: false,
  blocked: false,
  counts: { followers: 128, connections: 342 },
};

/** The organisation of the stub, public, verified, with a member who opened their page. */
const ORGANIZATION = {
  id: '0192f4a0-4000-7000-8000-000000000001',
  slug: 'fondation-teranga',
  name: 'Fondation Teranga',
  structureType: 'foundation',
  description:
    'Bourses, mentorat et dons en nature pour les jeunes femmes entrepreneures du Sénégal et du Mali.',
  countryCodes: ['SN', 'ML'],
  sectorCodes: ['education', 'agriculture_forestry_fishing'],
  websiteUrl: 'https://example.org',
  foundedYear: 2016,
  logoUrl: null,
  logoMediaId: null,
  coverUrl: null,
  coverMediaId: null,
  verification: { status: 'verified', verified: true, verifiedAt: '2026-09-15T09:00:00.000Z' },
  members: [
    {
      handle: 'aissatou-ba',
      displayName: 'Aïssatou Ba',
      headline: 'Fondatrice, Ferme solaire de Thiès',
      avatarUrl: null,
      role: 'owner',
    },
  ],
  projects: { carried: [], supported: [] },
  viewerRole: null,
  createdAt: '2026-09-01T09:00:00.000Z',
};

/** A page of a list read cursor by cursor, empty. */
const EMPTY_PAGE = { items: [], nextCursor: null };

/**
 * A reaction to a publication (`PUT` or `DELETE /v1/posts/{id}/reaction`), logged with its
 * Idempotency-Key: a key seen before is a replay, answered without applying it again.
 */
function reaction(request, path) {
  const match = /^\/v1\/posts\/([\w-]+)\/reaction$/.exec(path);
  if (!match || (request.method !== 'PUT' && request.method !== 'DELETE')) return null;
  const email = sessionOf(request);
  if (!email) return problem(401, 'UNAUTHENTICATED');
  const key = request.headers['idempotency-key'] ?? null;
  const replay = key !== null && state.writes.some((write) => write.key === key);
  state.writes.push({ route: 'reaction', email, key, replay, at: new Date().toISOString() });
  return {
    status: 200,
    body: {
      counts: { like: 13, bravo: 4, insightful: 2, support: 0 },
      total: 19,
      viewerReaction: request.method === 'PUT' ? 'like' : null,
    },
    headers: replay ? { 'idempotent-replayed': 'true' } : {},
  };
}

/** Pages of resources, `GET /v1/public/...` for a visitor, `GET /v1/...` for a member. */
function resource(request, path) {
  const publicProject = /^\/v1\/public\/projects\/([\w-]+)$/.exec(path);
  if (publicProject) {
    const slug = publicProject[1];
    return PROJECTS[slug]?.public
      ? { status: 200, body: projectOf(slug) }
      : problem(404, 'PROJECTS_NOT_FOUND');
  }
  const memberProject = /^\/v1\/projects\/by-slug\/([\w-]+)$/.exec(path);
  if (memberProject) {
    if (!sessionOf(request)) return problem(401, 'UNAUTHENTICATED');
    const slug = memberProject[1];
    return PROJECTS[slug]
      ? { status: 200, body: projectOf(slug) }
      : problem(404, 'PROJECTS_NOT_FOUND');
  }
  const profile = /^\/v1\/(public\/)?profiles\/([\w-]+)$/.exec(path);
  if (profile) {
    const account = Object.values(ACCOUNTS).find((candidate) => candidate.handle === profile[2]);
    if (!account || (!profile[1] && !sessionOf(request))) return problem(404, 'PROFILES_NOT_FOUND');
    // A visitor reads only the page a member opened to everyone.
    if (profile[1] && !account.publicPage) return problem(404, 'PROFILES_NOT_FOUND');
    return { status: 200, body: profileOf(account) };
  }
  const relationship = /^\/v1\/network\/members\/([\w-]+)\/relationship$/.exec(path);
  if (relationship) {
    const email = sessionOf(request);
    if (!email) return problem(401, 'UNAUTHENTICATED');
    const self = ACCOUNTS[email].handle === relationship[1];
    return {
      status: 200,
      body: self
        ? { ...RELATIONSHIP, degree: 'self', mutualConnections: { count: 0, capped: false } }
        : RELATIONSHIP,
    };
  }
  if (/^\/v1\/(public\/)?network\/members\/[\w-]+\/(connections|followers|following)$/.test(path)) {
    return { status: 200, body: EMPTY_PAGE };
  }
  const organization = /^\/v1\/(?:public\/organizations|organizations\/by-slug)\/([\w-]+)$/.exec(
    path,
  );
  if (organization) {
    if (organization[1] !== ORGANIZATION.slug) return problem(404, 'ORGANIZATIONS_NOT_FOUND');
    const member = path.startsWith('/v1/organizations/') ? sessionOf(request) : undefined;
    if (path.startsWith('/v1/organizations/') && !member) return problem(401, 'UNAUTHENTICATED');
    const viewerRole = member && ACCOUNTS[member].handle === 'aissatou-ba' ? 'owner' : null;
    return { status: 200, body: { ...ORGANIZATION, viewerRole } };
  }
  if (/^\/v1\/network\/follows\/(organization|project)\/[\w-]+$/.test(path)) {
    return sessionOf(request)
      ? { status: 200, body: { following: false, followers: 54 } }
      : problem(401, 'UNAUTHENTICATED');
  }
  if (path === '/v1/public/profiles') {
    const items = Object.values(ACCOUNTS)
      .filter((account) => account.publicPage)
      .map((account) => ({ handle: account.handle, updatedAt: '2026-10-01T09:00:00.000Z' }));
    return { status: 200, body: { items, nextCursor: null } };
  }
  if (path === '/v1/public/organizations') {
    return {
      status: 200,
      body: {
        items: [{ slug: ORGANIZATION.slug, updatedAt: '2026-10-01T09:00:00.000Z' }],
        nextCursor: null,
      },
    };
  }
  if (path === '/v1/public/projects' || path === '/v1/projects') {
    const items = Object.keys(PROJECTS)
      .filter((slug) => PROJECTS[slug].public)
      .map(projectOf);
    return { status: 200, body: { items, nextCursor: null } };
  }
  if (path === '/v1/public/events') return { status: 200, body: { items: [], nextCursor: null } };
  return null;
}

let state = fresh();

function fresh() {
  return { counters: new Map(), writes: [] };
}

function countersOf(email) {
  if (!state.counters.has(email)) state.counters.set(email, structuredClone(INITIAL_COUNTERS));
  return state.counters.get(email);
}

function currentUser(email) {
  const account = ACCOUNTS[email];
  return {
    user: {
      id: `0192f4a0-0000-7000-8000-${Buffer.from(email).toString('hex').slice(0, 12)}`,
      email,
      emailVerified: account.emailVerified,
      name: account.name,
      image: null,
      twoFactorEnabled: account.twoFactorEnabled,
      createdAt: '2026-09-01T09:00:00.000Z',
    },
    preferences: { locale: 'fr', timeZone: 'Africa/Dakar' },
    activeLocales: ['fr', 'en'],
    legal: {
      upToDate: account.legalUpToDate,
      acceptedTermsVersion: account.legalUpToDate ? '2026-10-01' : '2026-09-01',
      acceptedPrivacyVersion: account.legalUpToDate ? '2026-10-01' : '2026-09-01',
      adultDeclaredAt: '2026-09-01T09:00:00.000Z',
      current: { termsVersion: '2026-10-01', privacyVersion: '2026-10-01', minimumAge: 18 },
    },
    roles: account.roles,
    trust: {
      emailVerified: account.emailVerified,
      kycVerified: false,
      suspended: account.suspended,
    },
    profile: {
      handle: account.handle,
      displayName: account.name,
      headline: account.headline,
      avatarUrl: null,
      intention: 'carry_project',
      facets: { entrepreneur: true, contributor: false },
      publicPageEnabled: true,
    },
    profileStrength: { level: 'intermediate', percent: 60, missing: ['avatar', 'cover'] },
  };
}

function sessionOf(request) {
  // Lighthouse cannot set a cookie: it sends the session in a header of its own as well.
  const header = request.headers['x-stub-session'];
  if (typeof header === 'string' && ACCOUNTS[header]) return header;
  const cookie = request.headers.cookie ?? '';
  const token = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const email = token ? decodeURIComponent(token) : undefined;
  return email && ACCOUNTS[email] ? email : undefined;
}

function problem(status, code) {
  return { status, body: { type: 'about:blank', title: code, status, code } };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

let io;

/** Routes of the stub: `[method path]` to a handler returning `{ status, body, headers? }`. */
const routes = {
  'GET /v1/locales': () => ({ status: 200, body: { defaultLocale: 'fr', locales: ['fr', 'en'] } }),
  'GET /v1/auth-configuration': () => ({
    status: 200,
    body: {
      oauthProviders: ['google', 'linkedin', 'microsoft'],
      turnstile: null,
      legal: { termsVersion: 'stub-2026-10', privacyVersion: 'stub-2026-10', minimumAge: 18 },
      minPasswordLength: 12,
    },
  }),
  'GET /v1/health/ready': () => ({
    status: 200,
    body: { status: 'ok', checks: { database: { status: 'up', latencyMs: 1 } } },
  }),
  'POST /v1/auth/sign-in/email': async (request) => {
    const { email, password } = await readJson(request);
    if (!ACCOUNTS[email] || password !== DEMO_PASSWORD) {
      return { status: 401, body: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid' } };
    }
    return {
      status: 200,
      body: { redirect: false, token: email, user: currentUser(email).user },
      headers: {
        'set-cookie': `${SESSION_COOKIE}=${encodeURIComponent(email)}; Path=/; HttpOnly; SameSite=Lax`,
      },
    };
  },
  'POST /v1/auth/sign-out': () => ({
    status: 200,
    body: { success: true },
    headers: { 'set-cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0` },
  }),
  'POST /v1/auth/send-verification-email': (request) =>
    sessionOf(request) ? { status: 200, body: { status: true } } : problem(401, 'UNAUTHENTICATED'),
  // Lists of the forms of a profile and an organization: a few entries of each (labels: i18n).
  'GET /v1/reference-data': () => ({
    status: 200,
    body: {
      countries: ['SN', 'CI', 'CM', 'FR', 'HT'].map((code) => ({
        code,
        labelKey: `countries.${code}`,
        m49Region: code === 'FR' ? '150' : code === 'HT' ? '019' : '002',
        m49SubRegion: null,
        m49IntermediateRegion: code === 'HT' ? '029' : null,
        eligibleForCompany: code !== 'FR',
      })),
      sectors: [
        { code: 'energy', labelKey: 'sectors.energy', isicSection: 'D' },
        {
          code: 'agriculture_forestry_fishing',
          labelKey: 'sectors.agriculture_forestry_fishing',
          isicSection: 'A',
        },
      ],
      stages: ['idea', 'prototype'].map((code) => ({ code, labelKey: `stages.${code}` })),
      intentions: [],
      contributorHats: [],
      structureTypes: ['foundation', 'company'].map((code) => ({
        code,
        labelKey: `structureTypes.${code}`,
      })),
      fundingInstruments: [],
      patronageTypes: [],
      entrepreneurNeeds: [],
    },
  }),
  'GET /v1/me': (request) => {
    const email = sessionOf(request);
    return email ? { status: 200, body: currentUser(email) } : problem(401, 'UNAUTHENTICATED');
  },
  'GET /v1/me/counters': (request) => {
    const email = sessionOf(request);
    return email ? { status: 200, body: countersOf(email) } : problem(401, 'UNAUTHENTICATED');
  },
  'POST /v1/me/notifications/read-all': (request) => {
    const email = sessionOf(request);
    if (!email) return problem(401, 'UNAUTHENTICATED');
    const key = request.headers['idempotency-key'] ?? null;
    const replay = key !== null && state.writes.some((write) => write.key === key);
    state.writes.push({ route: 'read-all', email, key, replay, at: new Date().toISOString() });
    const counters = countersOf(email);
    const read = counters.notifications;
    counters.notifications = 0;
    io?.emit('counters', { counters });
    return {
      status: 200,
      body: { read: replay ? 0 : read },
      headers: replay ? { 'idempotent-replayed': 'true' } : {},
    };
  },
  'GET /v1/discovery/suggestions': (request) =>
    sessionOf(request)
      ? { status: 200, body: { items: SUGGESTIONS, nextCursor: null } }
      : problem(401, 'UNAUTHENTICATED'),
  'PUT /v1/me/preferences': async (request) => {
    const email = sessionOf(request);
    if (!email) return problem(401, 'UNAUTHENTICATED');
    const { locale } = await readJson(request);
    return { status: 200, body: { locale, timeZone: 'Africa/Dakar' } };
  },
  'POST /__test/emit': async (request) => {
    const { event, payload } = await readJson(request);
    if (event === 'counters') {
      for (const email of Object.keys(ACCOUNTS)) {
        if (state.counters.has(email)) Object.assign(state.counters.get(email), payload.counters);
      }
    }
    // Counted before the emit, in the namespace: a socket counted here has received the event.
    const sockets = io.of('/').sockets.size;
    io.emit(event, payload);
    return { status: 200, body: { emitted: event, sockets } };
  },
  'POST /v1/network/connection-requests': async (request) => {
    const email = sessionOf(request);
    if (!email) return problem(401, 'UNAUTHENTICATED');
    const { handle } = await readJson(request);
    state.writes.push({ route: 'connection-request', email, handle, at: new Date().toISOString() });
    return { status: 201, body: { id: `request-${handle}`, status: 'pending' } };
  },
  'POST /v1/discovery/dismissals': async (request) => {
    const email = sessionOf(request);
    if (!email) return problem(401, 'UNAUTHENTICATED');
    const { kind, key } = await readJson(request);
    state.writes.push({ route: 'dismiss', email, kind, key, at: new Date().toISOString() });
    return { status: 204, body: null };
  },
  'GET /v1/me/profile': (request) => {
    const email = sessionOf(request);
    return email ? { status: 200, body: ownProfileOf(email) } : problem(401, 'UNAUTHENTICATED');
  },
  'GET /v1/me/profile-views/summary': (request) =>
    sessionOf(request)
      ? {
          status: 200,
          body: { last7Days: 12, last30Days: 47, last90Days: 131, retentionDays: 90 },
        }
      : problem(401, 'UNAUTHENTICATED'),
  'GET /v1/me/profile-views': (request) =>
    sessionOf(request) ? { status: 200, body: EMPTY_PAGE } : problem(401, 'UNAUTHENTICATED'),
  'GET /v1/me/network/settings': (request) =>
    sessionOf(request)
      ? { status: 200, body: { privateProfileViews: false } }
      : problem(401, 'UNAUTHENTICATED'),
  'GET /v1/me/network/blocks': (request) =>
    sessionOf(request) ? { status: 200, body: EMPTY_PAGE } : problem(401, 'UNAUTHENTICATED'),
  'GET /v1/me/network/connection-requests': (request) =>
    sessionOf(request) ? { status: 200, body: EMPTY_PAGE } : problem(401, 'UNAUTHENTICATED'),
  'GET /v1/me/organizations': (request) => {
    const email = sessionOf(request);
    if (!email) return problem(401, 'UNAUTHENTICATED');
    const owner = ACCOUNTS[email].handle === 'aissatou-ba';
    const { id, slug, name, logoUrl } = ORGANIZATION;
    return {
      status: 200,
      body: { items: owner ? [{ id, slug, name, logoUrl, verified: true, role: 'owner' }] : [] },
    };
  },
  'GET /__test/writes': () => ({ status: 200, body: state.writes }),
  // Newer publications of the network the feed will be told about (ADR 0117).
  'POST /__test/newer': async (request) => {
    const { count } = await readJson(request);
    state.newer = count;
    return { status: 200, body: { newer: count } };
  },
  'POST /__test/reset': () => {
    state = fresh();
    return { status: 200, body: { reset: true } };
  },
};

/** Actions of the console: a privileged role, then its second factor (ADR 0015). */
const CONSOLE_ACTIONS = ['trust.moderation.read'];

/**
 * `GET /v1/me/prerequisites/{action}`: a verified email is needed to publish or create; the
 * console needs a privileged role, then a second factor.
 */
function prerequisites(request, action) {
  const email = sessionOf(request);
  if (!email) return problem(401, 'UNAUTHENTICATED');
  const account = ACCOUNTS[email];
  if (CONSOLE_ACTIONS.includes(action) && !account.roles.some((role) => role !== 'member')) {
    return { status: 200, body: { action, allowed: false, code: 'FORBIDDEN', missing: [] } };
  }
  const missing = [];
  if (!account.legalUpToDate) missing.push('legal_acceptance');
  if (!account.emailVerified && ['content.post.create', 'project.create'].includes(action)) {
    missing.push('email_verified');
  }
  if (CONSOLE_ACTIONS.includes(action) && !account.twoFactorEnabled) missing.push('two_factor');
  return {
    status: 200,
    body: {
      action,
      allowed: missing.length === 0 && !account.suspended,
      code:
        missing.length > 0
          ? 'ACCESS_PREREQUISITES_MISSING'
          : account.suspended
            ? 'ACCESS_SUSPENDED'
            : null,
      missing,
    },
  };
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://stub').pathname;
  const cors = {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
  };
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      ...cors,
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
      'access-control-allow-headers':
        'content-type, idempotency-key, accept-language, x-time-zone, x-stub-session',
      'access-control-max-age': '600',
    });
    response.end();
    return;
  }
  const prerequisite = /^\/v1\/me\/prerequisites\/([\w.-]+)$/.exec(path);
  // Undo of a « Pas intéressé » (`DELETE /v1/discovery/dismissals/{kind}/{key}`).
  const undo = /^\/v1\/discovery\/dismissals\/(\w+)\/([\w-]+)$/.exec(path);
  if (undo && request.method === 'DELETE') {
    state.writes.push({ route: 'undo-dismiss', kind: undo[1], key: undo[2] });
    response.writeHead(204, cors);
    response.end();
    return;
  }
  const handler = routes[`${request.method} ${path}`];
  const read = request.method === 'GET' ? resource(request, path) : reaction(request, path);
  const result = prerequisite
    ? prerequisites(request, prerequisite[1])
    : handler
      ? await handler(request)
      : (read ?? (await content(request, path)) ?? problem(404, 'NOT_FOUND'));
  const ok = result.status < 400;
  response.writeHead(result.status, {
    'content-type': ok ? 'application/json' : 'application/problem+json',
    ...cors,
    ...result.headers,
  });
  response.end(result.raw ?? (result.status === 204 ? undefined : JSON.stringify(result.body)));
});

const content = contentRoutes({
  origin: `http://localhost:${port}`,
  authors: AUTHORS,
  accounts: ACCOUNTS,
  sessionOf,
  problem,
  readJson,
  state: () => state,
});

io = new Server(server, { cors: { origin, credentials: true }, transports: ['websocket'] });

server.listen(port, () => process.stdout.write(`stub api on ${port}\n`));
