// Discovery, events, missions and pending invitations of the stub api (PROMPT FRONT 7): the
// search and its autocompletion, the Discover page, the events with their registration, the
// missions with their engagements, the personal calendar and the invitations to an organisation.
// Dates are fixed far enough ahead to stay upcoming: the captures read the same at every run.

const ID = (n) => `0192f4a0-7000-7000-8000-${String(n).padStart(12, '0')}`;

const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const member = (handle, displayName, headline = null) => ({
  handle,
  displayName,
  headline,
  avatarUrl: null,
});

const AISSATOU = member('aissatou-ba', 'Aïssatou Ba', 'Fondatrice, Ferme solaire de Thiès');
const KOFI = member('kofi-mensah', 'Kofi Mensah', 'Mentor finance, Accra');
const THIERRY = member('thierry-lacroix', 'Thierry Lacroix', 'Expert-comptable, Lyon');
const MARIECLAIRE = member('marie-claire-joseph', 'Marie-Claire Joseph', 'Coopérative, Jacmel');

const TERANGA = {
  id: ID(900),
  slug: 'fondation-teranga',
  name: 'Fondation Teranga',
  logoUrl: null,
  verified: true,
};

const person = (m, extra = {}) => ({
  kind: 'person',
  key: m.handle,
  title: m.displayName,
  subtitle: m.headline,
  imageUrl: null,
  countryCodes: ['SN'],
  sectorCodes: ['energy'],
  facets: { entrepreneur: true, contributor: false },
  hats: [],
  ...extra,
});

/** Every card the search and Discover know, by kind. */
const CARDS = [
  person(AISSATOU),
  person(KOFI, {
    countryCodes: ['GH'],
    sectorCodes: ['finance_insurance'],
    facets: { entrepreneur: false, contributor: true },
    hats: ['mentor'],
  }),
  person(THIERRY, {
    countryCodes: ['FR'],
    sectorCodes: ['professional_scientific_technical'],
    facets: { entrepreneur: false, contributor: true },
    hats: ['expert'],
  }),
  {
    kind: 'organization',
    key: 'fondation-teranga',
    title: 'Fondation Teranga',
    subtitle: 'Bourses et mentorat pour les étudiants entrepreneurs',
    imageUrl: null,
    countryCodes: ['SN', 'FR'],
    sectorCodes: ['education'],
    structureType: 'foundation',
    verified: true,
  },
  {
    kind: 'project',
    key: 'pompes-solaires-thies',
    title: 'Pompes solaires pour les maraîchères de Thiès',
    subtitle: 'Irriguer trois hectares sans gasoil',
    imageUrl: `http://localhost:${process.env.STUB_API_PORT ?? 3299}/files/project-1.png`,
    countryCodes: ['SN'],
    sectorCodes: ['energy'],
    status: 'funding',
    impactScore: 72,
    endsAt: '2027-03-30T23:00:00.000Z',
  },
  {
    kind: 'project',
    key: 'sechoir-soubre',
    title: 'Séchoir solaire de cacao à Soubré',
    subtitle: 'Sécher mieux, vendre plus cher',
    imageUrl: `http://localhost:${process.env.STUB_API_PORT ?? 3299}/files/project-6.png`,
    countryCodes: ['CI'],
    sectorCodes: ['agriculture_forestry_fishing'],
    status: 'funding',
    impactScore: null,
    endsAt: '2027-02-12T23:00:00.000Z',
  },
  {
    kind: 'event',
    key: 'atelier-levee-de-fonds',
    title: 'Atelier : préparer sa première levée de fonds',
    subtitle: 'Kofi Mensah',
    imageUrl: null,
    countryCodes: ['GH'],
    sectorCodes: ['finance_insurance'],
    format: 'hybrid',
    startsAt: '2027-03-14T18:00:00.000Z',
    endsAt: '2027-03-14T20:00:00.000Z',
    timeZone: 'Africa/Accra',
  },
  {
    kind: 'event',
    key: 'webinaire-mecenat-diaspora',
    title: 'Webinaire : mécénat de compétences et diaspora',
    subtitle: 'Fondation Teranga',
    imageUrl: null,
    countryCodes: ['SN', 'FR'],
    sectorCodes: ['education'],
    format: 'online',
    startsAt: '2027-04-02T17:00:00.000Z',
    endsAt: '2027-04-02T18:30:00.000Z',
    timeZone: 'Europe/Paris',
  },
  {
    kind: 'mission',
    key: ID(301),
    title: 'Revue de votre plan de financement',
    subtitle: 'Thierry Lacroix',
    imageUrl: null,
    countryCodes: [],
    sectorCodes: ['finance_insurance'],
    direction: 'offer',
    missionKind: 'expertise',
    mode: 'remote',
  },
  {
    kind: 'mission',
    key: ID(302),
    title: 'Structurer la distribution des kits solaires',
    subtitle: 'Aïssatou Ba',
    imageUrl: null,
    countryCodes: ['SN'],
    sectorCodes: ['energy'],
    direction: 'request',
    missionKind: 'mentoring',
    mode: 'on_site',
  },
];

/**
 * A card answers a query when each word of it starts a word of its title or subtitle, accents
 * ignored; or when the title is one letter away from a word (the typo tolerance of the api).
 */
function matches(card, query) {
  const words = fold(`${card.title} ${card.subtitle ?? ''}`).split(/[^\p{L}\p{N}]+/u);
  const terms = fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (terms.length === 0) return true;
  const near = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    let edits = 0;
    for (let i = 0, j = 0; i < a.length || j < b.length;) {
      if (a[i] === b[j]) {
        i++;
        j++;
        continue;
      }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else {
        i++;
        j++;
      }
    }
    return true;
  };
  return terms.every((term) =>
    words.some((word) => word.startsWith(term) || (term.length >= 4 && near(word, term))),
  );
}

const PUBLIC_KINDS = new Set(['organization', 'project', 'event', 'mission']);

function sentence(rule, params) {
  return { key: 'sentences.one', clauses: [{ key: `reasons.${rule}`, params }] };
}

const organizer = (m) => ({ kind: 'member', member: m });

/** The fields of an event card (the page adds its details). */
const EVENT_CARD_FIELDS = [
  'id',
  'slug',
  'title',
  'format',
  'status',
  'startsAt',
  'endsAt',
  'timeZone',
  'city',
  'countryCode',
  'language',
  'sectorCodes',
  'imageUrl',
  'imageAlt',
  'organizer',
  'capacity',
  'registeredCount',
  'full',
];

function eventView(base) {
  return {
    status: 'published',
    city: null,
    countryCode: null,
    language: 'fr',
    sectorCodes: [],
    imageUrl: null,
    imageAlt: null,
    capacity: null,
    registeredCount: 0,
    full: false,
    description: '',
    visibility: 'public',
    location: null,
    onlineUrl: null,
    countryCodes: [],
    imageMediaId: null,
    waitlistCount: 0,
    project: null,
    publishedAt: '2026-09-01T09:00:00.000Z',
    canceledAt: null,
    cancelReason: null,
    viewer: null,
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...base,
  };
}

function seedEvents() {
  return [
    eventView({
      id: ID(201),
      slug: 'atelier-levee-de-fonds',
      title: 'Atelier : préparer sa première levée de fonds',
      format: 'hybrid',
      startsAt: '2027-03-14T18:00:00.000Z',
      endsAt: '2027-03-14T20:00:00.000Z',
      timeZone: 'Africa/Accra',
      city: 'Accra',
      countryCode: 'GH',
      language: 'en',
      sectorCodes: ['finance_insurance', 'information_communication'],
      organizer: organizer(KOFI),
      capacity: 3,
      registeredCount: 3,
      full: true,
      waitlistCount: 1,
      description:
        '## Programme\n\nUn atelier pratique en petit comité : **tableau de financement**, ticket, calendrier.\n\n- Les investisseurs de la diaspora\n- Le calendrier d’une levée',
      visibility: 'members',
      location: { name: 'Impact Hub Accra', address: null, city: 'Accra', countryCode: 'GH' },
      onlineUrl: 'https://meet.example.org/levee-de-fonds',
      countryCodes: ['GH', 'SN'],
      registrations: ['samuel', 'grace', 'ama'],
      waitlist: ['rodrigue'],
    }),
    eventView({
      id: ID(202),
      slug: 'webinaire-mecenat-diaspora',
      title: 'Webinaire : mécénat de compétences et diaspora',
      format: 'online',
      startsAt: '2027-04-02T17:00:00.000Z',
      endsAt: '2027-04-02T18:30:00.000Z',
      timeZone: 'Europe/Paris',
      sectorCodes: ['education'],
      organizer: { kind: 'organization', organization: TERANGA },
      description: 'Comment la diaspora accompagne les entrepreneurs, sans billetterie ni frais.',
      onlineUrl: 'https://meet.example.org/mecenat-diaspora',
      countryCodes: ['SN', 'CI', 'HT'],
      registeredCount: 2,
      registrations: [],
      waitlist: [],
    }),
    eventView({
      id: ID(203),
      slug: 'forum-caraibes-diaspora',
      title: 'Forum Caraïbes-diaspora de l’économie solidaire',
      format: 'hybrid',
      startsAt: '2027-05-20T14:00:00.000Z',
      endsAt: '2027-05-20T18:00:00.000Z',
      timeZone: 'America/Port-au-Prince',
      city: 'Jacmel',
      countryCode: 'HT',
      sectorCodes: ['accommodation_food', 'finance_insurance'],
      organizer: organizer(MARIECLAIRE),
      capacity: 120,
      registeredCount: 2,
      location: {
        name: 'Parc historique de la canne',
        address: null,
        city: 'Jacmel',
        countryCode: 'HT',
      },
      onlineUrl: 'https://meet.example.org/forum-caraibes',
      countryCodes: ['HT', 'FR'],
      description:
        'Tables rondes sur les **coopératives**, le tourisme solidaire et les transferts.',
      registrations: [],
      waitlist: [],
    }),
    eventView({
      id: ID(204),
      slug: 'rencontre-assureurs-kano',
      title: 'Rencontre des assureurs agricoles de Kano',
      format: 'in_person',
      status: 'canceled',
      startsAt: '2027-02-18T10:00:00.000Z',
      endsAt: '2027-02-18T12:00:00.000Z',
      timeZone: 'Africa/Lagos',
      city: 'Kano',
      countryCode: 'NG',
      language: 'en',
      organizer: organizer(member('samuel-okafor', 'Samuel Okafor', 'Assureur, Kano')),
      capacity: 30,
      registeredCount: 2,
      visibility: 'members',
      location: { name: 'Chambre de commerce', address: null, city: 'Kano', countryCode: 'NG' },
      canceledAt: '2026-10-01T09:00:00.000Z',
      cancelReason: 'La salle n’est plus disponible ; une nouvelle date sera annoncée.',
      registrations: [],
      waitlist: [],
    }),
  ];
}

function missionCard(base) {
  return {
    sectorCodes: [],
    countryCodes: [],
    languages: ['fr'],
    status: 'open',
    publishedAt: '2026-09-20T09:00:00.000Z',
    ...base,
  };
}

function seedMissions() {
  return [
    {
      ...missionCard({
        id: ID(301),
        direction: 'offer',
        title: 'Revue de votre plan de financement',
        kind: 'expertise',
        domain: 'Finance',
        format: 'session',
        mode: 'remote',
        estimatedHours: 4,
        sectorCodes: ['finance_insurance'],
        author: { member: THIERRY, project: null },
      }),
      description:
        'Deux sessions pour relire votre plan, vos hypothèses et votre calendrier de levée.\nJe partage une grille de lecture et mes questions de banquier.',
      skills: [],
      desiredBy: null,
      capacity: 2,
      activeEngagements: 1,
      visibility: 'members',
      closedAt: null,
      updatedAt: '2026-09-20T09:00:00.000Z',
    },
    {
      ...missionCard({
        id: ID(302),
        direction: 'request',
        title: 'Structurer la distribution des kits solaires',
        kind: 'mentoring',
        domain: 'Distribution',
        format: 'short_mission',
        mode: 'on_site',
        estimatedHours: 10,
        countryCodes: ['SN'],
        sectorCodes: ['energy'],
        author: {
          member: AISSATOU,
          project: {
            id: ID(400),
            slug: 'pompes-solaires-thies',
            title: 'Pompes solaires de Thiès',
          },
        },
      }),
      description: 'Nous cherchons un regard expérimenté sur notre réseau de revendeurs ruraux.',
      skills: ['Distribution rurale', 'Location-vente'],
      desiredBy: '2027-01-15',
      capacity: 1,
      activeEngagements: 0,
      visibility: 'members',
      closedAt: null,
      updatedAt: '2026-09-21T09:00:00.000Z',
    },
  ];
}

/** The fields of a mission card (the page adds its details). */
const MISSION_CARD_FIELDS = [
  'id',
  'direction',
  'title',
  'kind',
  'domain',
  'format',
  'mode',
  'estimatedHours',
  'sectorCodes',
  'countryCodes',
  'languages',
  'status',
  'author',
  'publishedAt',
];

const pick = (object, keys) => Object.fromEntries(keys.map((key) => [key, object[key]]));

function engagementOf(mission, base) {
  return {
    mission: pick(mission, MISSION_CARD_FIELDS),
    project: null,
    answerMessage: null,
    timeEntry: null,
    answeredAt: null,
    endedAt: null,
    ...base,
  };
}

/** Which invitations to an organisation a member has (the address of their verified email). */
const RECEIVED = {
  'aissatou-ba': [
    {
      id: ID(501),
      organization: {
        slug: 'diaspora-invest-caraibes',
        name: 'Diaspora Invest Caraïbes',
        logoUrl: null,
        verified: false,
      },
      role: 'admin',
      expiresAt: '2027-01-20T10:00:00.000Z',
      createdAt: '2026-10-05T10:00:00.000Z',
    },
  ],
};

export function discoveryRoutes({ origin, accounts, sessionOf, problem, readJson, state }) {
  const data = () =>
    (state().discovery ??= {
      events: seedEvents(),
      missions: seedMissions(),
      engagements: null,
      received: structuredClone(RECEIVED),
      calendar: null,
    });
  const log = (route, extra = {}) => state().writes.push({ route, ...extra });
  const handleOf = (email) => accounts[email]?.handle;
  const ok = (body, status = 200) => ({ status, body });

  function engagements() {
    const d = data();
    d.engagements ??= [
      engagementOf(d.missions[0], {
        id: ID(601),
        status: 'requested',
        expert: THIERRY,
        beneficiary: AISSATOU,
        message: 'Bonjour Thierry, pouvez-vous relire notre plan de financement ?',
        requestedAt: '2026-10-08T09:00:00.000Z',
      }),
      engagementOf(d.missions[1], {
        id: ID(602),
        status: 'completed',
        expert: KOFI,
        beneficiary: AISSATOU,
        message: 'J’ai monté un réseau de revendeurs au Togo, je peux vous aider.',
        answerMessage: 'Avec plaisir, commençons lundi.',
        timeEntry: { id: ID(701), minutes: 150, status: 'declared' },
        requestedAt: '2026-09-25T09:00:00.000Z',
        answeredAt: '2026-09-26T09:00:00.000Z',
        endedAt: '2026-10-06T09:00:00.000Z',
      }),
    ];
    return d.engagements;
  }

  function eventCard(event) {
    return pick(event, EVENT_CARD_FIELDS);
  }

  function viewOf(event, email) {
    const { registrations, waitlist, ...view } = event;
    const handle = handleOf(email);
    const key = handle?.split('-')[0];
    const registered = key ? registrations.includes(key) : false;
    const position = key ? waitlist.indexOf(key) : -1;
    const manager = event.organizer.kind === 'member' && event.organizer.member.handle === handle;
    return {
      ...view,
      onlineUrl: registered || manager ? event.onlineUrl : null,
      viewer: email
        ? {
            registration: registered ? 'registered' : position >= 0 ? 'waitlisted' : null,
            waitlistPosition: position >= 0 ? position + 1 : null,
            showInAttendees: false,
            canManage: manager,
          }
        : null,
    };
  }

  return async function discovery(request, path, url) {
    const email = sessionOf(request);
    const method = request.method;
    const d = data();
    const q = url.searchParams.get('q') ?? '';

    // Search and autocompletion: public documents only without a session.
    if (/^\/v1(\/public)?\/discovery\/(autocomplete|search)$/.test(path) && method === 'GET') {
      const visitor = path.startsWith('/v1/public/');
      if (!visitor && !email) return problem(401, 'UNAUTHENTICATED');
      const kinds = url.searchParams.get('kinds')?.split(',');
      const found = CARDS.filter(
        (card) =>
          (!visitor || PUBLIC_KINDS.has(card.kind)) &&
          (!kinds || kinds.includes(card.kind)) &&
          matches(card, q) &&
          (!url.searchParams.get('countryCode') ||
            card.countryCodes.includes(url.searchParams.get('countryCode'))),
      );
      if (path.endsWith('autocomplete')) {
        return ok({
          items: found.slice(0, Number(url.searchParams.get('limit') ?? 8)).map((card) => ({
            kind: card.kind,
            key: card.key,
            title: card.title,
            subtitle: card.subtitle,
          })),
        });
      }
      return ok({ items: found, nextCursor: null });
    }

    // Discover: the sections in the order of the api, suggested profiles for a member only.
    const section = /^\/v1(\/public)?\/discovery\/(page|sections\/(\w+))$/.exec(path);
    if (section && method === 'GET') {
      const visitor = Boolean(section[1]);
      if (!visitor && !email) return problem(401, 'UNAUTHENTICATED');
      const projects = CARDS.filter((card) => card.kind === 'project');
      const pages = {
        recent_projects: projects,
        ending_soon_projects: [projects[1]],
        suggested_profiles: [CARDS[1], CARDS[2]],
        editorial: [projects[0]],
        upcoming_events: CARDS.filter((card) => card.kind === 'event'),
        open_missions: CARDS.filter((card) => card.kind === 'mission'),
      };
      const sentences = {
        suggested_profiles: [
          sentence('mentoring_available', {}),
          sentence('shared_sector', { sector: 'finance_insurance' }),
        ],
      };
      const page = (name) => ({
        section: name,
        items: pages[name],
        sentences: pages[name].map((_, index) => sentences[name]?.[index] ?? null),
        nextCursor: null,
      });
      const names = Object.keys(pages).filter((name) => !visitor || name !== 'suggested_profiles');
      if (section[3]) {
        if (!names.includes(section[3])) return problem(404, 'NOT_FOUND');
        return ok(page(section[3]));
      }
      return ok({ sections: names.map(page) });
    }
    if (/^\/v1\/projects\/[\w-]+\/suggested-contributors$/.test(path) && method === 'GET') {
      return ok({
        items: [
          {
            candidate: CARDS[2],
            score: 60,
            sentence: sentence('hat_matches_need', { hat: 'expert', need: 'expertise' }),
            reasons: [],
            rulesVersion: 1,
          },
        ],
        nextCursor: null,
      });
    }

    // Events.
    if ((path === '/v1/events' || path === '/v1/public/events') && method === 'GET') {
      if (path === '/v1/events' && !email) return problem(401, 'UNAUTHENTICATED');
      const past = url.searchParams.get('period') === 'past';
      const format = url.searchParams.get('format');
      const items = d.events
        .filter((event) => (past ? false : event.status !== 'canceled'))
        .filter((event) => path === '/v1/events' || event.visibility === 'public')
        .filter((event) => !format || event.format === format)
        .map(eventCard);
      return ok({ items, nextCursor: null });
    }
    if (path === '/v1/me/events' && method === 'GET') {
      if (!email) return problem(401, 'UNAUTHENTICATED');
      const key = handleOf(email)?.split('-')[0];
      const organizer = url.searchParams.get('role') === 'organizer';
      const items = d.events
        .filter((event) =>
          organizer
            ? event.organizer.kind === 'member' && event.organizer.member.handle === handleOf(email)
            : event.registrations.includes(key) || event.waitlist.includes(key),
        )
        .map(eventCard);
      return ok({ items, nextCursor: null });
    }
    const bySlug = /^\/v1\/(?:events\/by-slug|public\/events)\/([\w-]+)$/.exec(path);
    if (bySlug && method === 'GET') {
      const event = d.events.find((item) => item.slug === bySlug[1]);
      const visitor = path.startsWith('/v1/public/');
      if (!event || (visitor && event.visibility !== 'public')) {
        return problem(404, 'EVENTS_NOT_FOUND');
      }
      if (!visitor && !email) return problem(401, 'UNAUTHENTICATED');
      return ok(viewOf(event, visitor ? null : email));
    }
    const registration = /^\/v1\/events\/([\w-]+)\/registration$/.exec(path);
    if (registration && email) {
      const event = d.events.find((item) => item.id === registration[1]);
      if (!event) return problem(404, 'EVENTS_NOT_FOUND');
      const key = handleOf(email).split('-')[0];
      if (method === 'PUT') {
        const body = await readJson(request);
        log('event-register', { event: event.slug, showInAttendees: body.showInAttendees });
        const full = event.capacity !== null && event.registeredCount >= event.capacity;
        if (full) {
          event.waitlist.push(key);
          event.waitlistCount += 1;
        } else {
          event.registrations.push(key);
          event.registeredCount += 1;
        }
        return ok({
          eventId: event.id,
          status: full ? 'waitlisted' : 'registered',
          waitlistPosition: full ? event.waitlist.length : null,
          showInAttendees: Boolean(body.showInAttendees),
          registeredAt: '2026-10-11T09:00:00.000Z',
        });
      }
      if (method === 'DELETE') {
        log('event-withdraw', { event: event.slug });
        event.registrations = event.registrations.filter((item) => item !== key);
        event.waitlist = event.waitlist.filter((item) => item !== key);
        return { status: 204 };
      }
    }
    const attendees = /^\/v1\/events\/([\w-]+)\/attendees$/.exec(path);
    if (attendees && method === 'GET') {
      return ok({
        items: [
          { member: KOFI, status: 'registered', registeredAt: '2026-10-01T09:00:00.000Z' },
          { member: THIERRY, status: 'registered', registeredAt: '2026-10-02T09:00:00.000Z' },
        ],
        nextCursor: null,
      });
    }
    if (path === '/v1/me/event-calendar' && email) {
      if (method === 'POST') {
        log('calendar-rotate');
        d.calendar = `${origin}/v1/calendars/c2VjcmV0LWNhbGVuZGFyLXRva2VuLWZvci1zdHViLTAwMQ.ics`;
        return ok({ url: d.calendar, createdAt: '2026-10-11T09:00:00.000Z' }, 201);
      }
      if (method === 'DELETE') {
        log('calendar-revoke');
        d.calendar = null;
        return { status: 204 };
      }
    }

    // Missions.
    if ((path === '/v1/missions' || path === '/v1/public/missions') && method === 'GET') {
      if (path === '/v1/missions' && !email) return problem(401, 'UNAUTHENTICATED');
      const direction = url.searchParams.get('direction');
      const items = d.missions
        .filter((mission) => path === '/v1/missions' || mission.visibility === 'public')
        .filter((mission) => !direction || mission.direction === direction)
        .map((mission) => engagementOf(mission, {}).mission);
      return ok({ items, nextCursor: null });
    }
    if (path === '/v1/me/missions' && method === 'GET') {
      if (!email) return problem(401, 'UNAUTHENTICATED');
      const items = d.missions
        .filter((mission) => mission.author.member.handle === handleOf(email))
        .map((mission) => engagementOf(mission, {}).mission);
      return ok({ items, nextCursor: null });
    }
    if (path === '/v1/me/mission-engagements' && method === 'GET') {
      if (!email) return problem(401, 'UNAUTHENTICATED');
      const handle = handleOf(email);
      const items = engagements().filter(
        (item) => item.expert.handle === handle || item.beneficiary.handle === handle,
      );
      return ok({ items, nextCursor: null });
    }
    const missionPath = /^\/v1\/(?:public\/)?missions\/([\w-]+)$/.exec(path);
    if (missionPath && method === 'GET' && !['offers', 'requests'].includes(missionPath[1])) {
      const mission = d.missions.find((item) => item.id === missionPath[1]);
      const visitor = path.startsWith('/v1/public/');
      if (!mission || (visitor && mission.visibility !== 'public')) {
        return problem(404, 'MISSIONS_NOT_FOUND');
      }
      if (!visitor && !email) return problem(401, 'UNAUTHENTICATED');
      const handle = handleOf(email);
      const own = engagements().find(
        (item) =>
          item.mission.id === mission.id &&
          (item.expert.handle === handle || item.beneficiary.handle === handle),
      );
      return ok({
        ...mission,
        viewer: visitor
          ? null
          : {
              isAuthor: mission.author.member.handle === handle,
              engagementId: own?.id ?? null,
              canEngage: !own,
            },
      });
    }
    const missionEngagements = /^\/v1\/missions\/([\w-]+)\/engagements$/.exec(path);
    if (missionEngagements && email) {
      const mission = d.missions.find((item) => item.id === missionEngagements[1]);
      if (!mission) return problem(404, 'MISSIONS_NOT_FOUND');
      if (method === 'GET') {
        return ok({
          items: engagements().filter((item) => item.mission.id === mission.id),
          nextCursor: null,
        });
      }
      if (method === 'POST') {
        const body = await readJson(request);
        log('mission-engage', { mission: mission.id, message: body.message });
        const me = member(handleOf(email), accounts[email].name, accounts[email].headline);
        const created = engagementOf(mission, {
          id: ID(650 + engagements().length),
          status: 'requested',
          expert: mission.direction === 'request' ? me : mission.author.member,
          beneficiary: mission.direction === 'request' ? mission.author.member : me,
          message: body.message,
          requestedAt: '2026-10-11T09:00:00.000Z',
        });
        engagements().push(created);
        return ok(created, 201);
      }
    }
    if ((path === '/v1/missions/offers' || path === '/v1/missions/requests') && method === 'POST') {
      if (!email) return problem(401, 'UNAUTHENTICATED');
      const body = await readJson(request);
      const text = `${body.title} ${body.description}`;
      if (/\b(salaire|cdi|recrutement|rémunération|full-time|hiring)\b/i.test(text)) {
        return problem(422, 'MISSIONS_JOB_POSTING_REFUSED');
      }
      log('mission-create', { direction: path.endsWith('offers') ? 'offer' : 'request' });
      return ok({ ...d.missions[0], id: ID(399), title: body.title }, 201);
    }
    const engagement =
      /^\/v1\/mission-engagements\/([\w-]+)(?:\/(accept|decline|complete|cancel))?$/.exec(path);
    if (engagement && email) {
      const found = engagements().find((item) => item.id === engagement[1]);
      if (!found) return problem(404, 'MISSIONS_ENGAGEMENT_NOT_FOUND');
      if (method === 'GET' && !engagement[2]) return ok(found);
      if (method === 'POST' && engagement[2]) {
        const body = await readJson(request).catch(() => ({}));
        log(`mission-${engagement[2]}`, { engagement: found.id });
        found.status = {
          accept: 'accepted',
          decline: 'declined',
          complete: 'completed',
          cancel: 'canceled',
        }[engagement[2]];
        if (engagement[2] === 'complete') {
          found.timeEntry = { id: ID(702), minutes: body.minutes ?? 60, status: 'declared' };
        }
        return engagement[2] === 'cancel' ? { status: 204 } : ok(found);
      }
    }

    // Invitations to the team of a project, answered with the consent to the public display.
    if (path === '/v1/me/project-invitations' && method === 'GET') {
      if (!email) return problem(401, 'UNAUTHENTICATED');
      if (handleOf(email) !== 'aissatou-ba' || d.teamAnswered) return ok({ items: [] });
      return ok({
        items: [
          {
            project: {
              id: ID(410),
              slug: 'reseau-cooperatives-jacmel',
              title: 'Réseau des coopératives de Jacmel',
              summary: 'Mutualiser la vente des artisans du Sud-Est',
              status: 'funding',
              sectorCode: 'manufacturing',
              countryCodes: ['HT'],
              coverImageUrl: `http://localhost:${process.env.STUB_API_PORT ?? 3299}/files/project-8.png`,
              owner: MARIECLAIRE,
              organization: null,
              funding: {
                goal: { amountMinor: '1500000', currency: 'EUR' },
                collected: { amountMinor: '420000', currency: 'EUR' },
                progressPercent: 28,
                contributionCount: 12,
                daysLeft: 34,
                instruments: ['donation'],
                opensCapital: false,
              },
              impact: null,
              featured: false,
              publishedAt: '2026-09-01T09:00:00.000Z',
              endsAt: '2027-03-01T09:00:00.000Z',
            },
            role: 'editor',
            function: 'Paiements mobiles',
            invitedBy: MARIECLAIRE,
            invitedAt: '2026-10-07T09:00:00.000Z',
          },
        ],
      });
    }
    const team = /^\/v1\/me\/project-invitations\/([\w-]+)\/(accept|decline)$/.exec(path);
    if (team && method === 'POST' && email) {
      const body = await readJson(request).catch(() => ({}));
      log(`team-invitation-${team[2]}`, { project: team[1], consent: body.publicDisplayConsent });
      d.teamAnswered = true;
      return { status: 204 };
    }

    // Invitations to an organisation sent to the verified email of the member.
    if (path === '/v1/me/organization-invitations' && method === 'GET') {
      if (!email) return problem(401, 'UNAUTHENTICATED');
      return ok({ items: d.received[handleOf(email)] ?? [] });
    }
    const answer = /^\/v1\/me\/organization-invitations\/([\w-]+)\/(accept|decline)$/.exec(path);
    if (answer && method === 'POST' && email) {
      const mine = d.received[handleOf(email)] ?? [];
      const invitation = mine.find((item) => item.id === answer[1]);
      if (!invitation) return problem(410, 'ORGANIZATIONS_INVITATION_INVALID');
      d.received[handleOf(email)] = mine.filter((item) => item !== invitation);
      log(`organization-invitation-${answer[2]}`, { invitation: invitation.id });
      return answer[2] === 'accept'
        ? ok({ id: ID(902), ...invitation.organization, role: invitation.role })
        : { status: 204 };
    }
    return null;
  };
}
