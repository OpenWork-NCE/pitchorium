// Stand-in for the api during the end-to-end tests of the web app: the routes the pages read,
// with the CORS headers of the real api. Sessions are created by the sign-in route of Better
// Auth with the demonstration accounts of `pnpm db:seed:dev` (frontend handoff); a real Socket.IO
// server pushes the events the tests ask for. Anything else answers an RFC 9457 404.
//
// Test routes (`/__test/*`): emit a realtime event, read the log of the writes, reset the state.
import { createServer } from 'node:http';
import { Server } from 'socket.io';

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

/** Fourteen publications: the modules of a narrow feed go after the third and the thirteenth. */
function feedPosts() {
  return Array.from({ length: 14 }, (_, index) => {
    const author = AUTHORS[index % AUTHORS.length];
    const id = `0192f4a0-2000-7000-8000-${String(index + 1).padStart(12, '0')}`;
    return {
      type: 'post',
      id,
      post: {
        id,
        author: { type: 'member', member: author },
        text: `Publication ${index + 1} de ${author.displayName} : un retour d’expérience de terrain.`,
        language: 'fr',
        languageSource: 'detected',
        visibility: 'members',
        images: [],
        document: null,
        link: null,
        mentions: [],
        projectId: null,
        commentsDisabled: false,
        reactions: {
          counts: { like: 12, bravo: 4, insightful: 2, support: 0 },
          total: 18,
          viewerReaction: null,
        },
        commentCount: 3,
        repostCount: 0,
        saved: false,
        viewerIsAuthor: false,
        featured: false,
        // Relative to now: « il y a 1 heure » whatever the day (reference screenshots).
        createdAt: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
        editedAt: null,
        kind: 'post',
        repostOf: null,
      },
    };
  });
}

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
  sentence: { key: 'sentences.one', clauses: [{ key: reason, params: { name: title } }] },
  reasons: [],
  rulesVersion: 1,
}));

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
  'GET /v1/feed': (request) =>
    sessionOf(request)
      ? { status: 200, body: { schemaVersion: 1, items: feedPosts(), nextCursor: null } }
      : problem(401, 'UNAUTHENTICATED'),
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
  'GET /__test/writes': () => ({ status: 200, body: state.writes }),
  'POST /__test/reset': () => {
    state = fresh();
    return { status: 200, body: { reset: true } };
  },
};

/** `GET /v1/me/prerequisites/{action}`: a verified email is needed to publish or create. */
function prerequisites(request, action) {
  const email = sessionOf(request);
  if (!email) return problem(401, 'UNAUTHENTICATED');
  const account = ACCOUNTS[email];
  const missing = [];
  if (!account.legalUpToDate) missing.push('legal_acceptance');
  if (!account.emailVerified && ['content.post.create', 'project.create'].includes(action)) {
    missing.push('email_verified');
  }
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
  const handler = routes[`${request.method} ${path}`];
  const result = prerequisite
    ? prerequisites(request, prerequisite[1])
    : handler
      ? await handler(request)
      : problem(404, 'NOT_FOUND');
  const ok = result.status < 400;
  response.writeHead(result.status, {
    'content-type': ok ? 'application/json' : 'application/problem+json',
    ...cors,
    ...result.headers,
  });
  response.end(JSON.stringify(result.body));
});

io = new Server(server, { cors: { origin, credentials: true }, transports: ['websocket'] });

server.listen(port, () => process.stdout.write(`stub api on ${port}\n`));
