import type {
  Comment,
  Counters,
  CursorPage,
  DiscoveryCard,
  FeedPage,
  Suggestion,
  CurrentUser,
  MemberCard,
  MemberSummary,
  Message,
  Notification,
  Post,
  PostStats,
  ProjectCard,
  ProjectTier,
} from '@pitchorium/contracts';

/**
 * Demonstration data of the compositions, typed by the contracts of the api: what the pages will
 * receive, never fetched (no call to any api). Entirely fictitious, like `pnpm db:seed:dev`.
 */

const at = (iso: string) => new Date(iso).toISOString();
const hoursAgo = (hours: number) =>
  new Date(Date.UTC(2026, 9, 8, 12) - hours * 3_600_000).toISOString();

export const members = {
  aissatou: {
    handle: 'aissatou-ba',
    displayName: 'Aïssatou Ba',
    headline: 'Fondatrice, Ferme solaire de Thiès',
    avatarUrl: null,
  },
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
  jean: {
    handle: 'jean-baptiste-pierre-louis',
    displayName: 'Jean-Baptiste Pierre-Louis',
    headline: 'Ingénieur agronome, Port-au-Prince',
    avatarUrl: null,
  },
  ifeoma: {
    handle: 'ifeoma-okafor',
    displayName: 'Ifeoma Okafor',
    headline: 'Designer produit, Lagos',
    avatarUrl: null,
  },
} satisfies Record<string, MemberCard>;

export const currentUser: CurrentUser = {
  user: {
    id: '0192f4a0-1c2b-7d3e-8f40-0a1b2c3d4e5f',
    email: 'aissatou.ba@demo.pitchorium.test',
    emailVerified: true,
    name: 'Aïssatou Ba',
    image: null,
    twoFactorEnabled: false,
    createdAt: at('2026-09-01T09:00:00Z'),
  },
  preferences: { locale: 'fr', timeZone: 'Africa/Dakar' },
  activeLocales: ['fr', 'en'],
  legal: {
    upToDate: true,
    acceptedTermsVersion: '2026-10-01',
    acceptedPrivacyVersion: '2026-10-01',
    adultDeclaredAt: at('2026-09-01T09:00:00Z'),
    current: { termsVersion: '2026-10-01', privacyVersion: '2026-10-01', minimumAge: 18 },
  },
  roles: ['member'],
  trust: { emailVerified: true, kycVerified: false, suspended: false },
  profile: {
    handle: 'aissatou-ba',
    displayName: 'Aïssatou Ba',
    headline: 'Fondatrice, Ferme solaire de Thiès',
    avatarUrl: null,
    intention: 'carry_project',
    facets: { entrepreneur: true, contributor: false },
    publicPageEnabled: true,
  },
  profileStrength: { level: 'intermediate', percent: 60, missing: ['avatar', 'cover'] },
};

export const counters: Counters = {
  notifications: 3,
  messages: { unread: 2, conversations: 1 },
  messageRequests: 0,
  invitations: { connections: 1, introductions: 0, projects: 0, organizations: 0 },
};

function post(
  id: string,
  author: MemberCard,
  text: string,
  hours: number,
  reactions: number,
): Post {
  return {
    id,
    author: { type: 'member', member: author },
    text,
    language: 'fr',
    languageSource: 'detected',
    visibility: 'public',
    images: [],
    document: null,
    link: null,
    mentions: [],
    projectId: null,
    commentsDisabled: false,
    reactions: {
      counts: { like: reactions, bravo: Math.floor(reactions / 3), insightful: 2, support: 1 },
      total: reactions + Math.floor(reactions / 3) + 3,
      viewerReaction: null,
    },
    commentCount: Math.floor(reactions / 4),
    repostCount: 1,
    saved: false,
    viewerIsAuthor: false,
    featured: false,
    moderation: 'visible',
    createdAt: hoursAgo(hours),
    editedAt: null,
    kind: 'post',
    repostOf: null,
  };
}

export const feed: Post[] = [
  post(
    '0192f4a0-2000-7000-8000-000000000001',
    members.kofi,
    'Atelier gratuit jeudi à Accra : bâtir un premier tableau de trésorerie pour une coopérative agricole. Les places sont limitées, écrivez-moi si vous voulez venir avec votre équipe.',
    2,
    24,
  ),
  post(
    '0192f4a0-2000-7000-8000-000000000002',
    members.nadia,
    'Nous ouvrons un fonds d’amorçage pour des projets d’énergie solaire au Sahel. Critères : équipe locale, prototype en service, premiers clients. Je lis tous les dossiers.',
    5,
    41,
  ),
  post(
    '0192f4a0-2000-7000-8000-000000000003',
    members.jean,
    'Retour d’expérience sur six mois de maraîchage en agroécologie à Kenscoff : rendements, sols et ce que nous changerions.',
    26,
    12,
  ),
];

/** A member as the suggestions present them (discovery card of a person). */
export function personCard(member: MemberCard): Extract<DiscoveryCard, { kind: 'person' }> {
  return {
    kind: 'person',
    key: member.handle,
    title: member.displayName,
    subtitle: member.headline,
    imageUrl: member.avatarUrl,
    countryCodes: [],
    sectorCodes: [],
    facets: { entrepreneur: false, contributor: true },
    hats: [],
  };
}

/** The first page of the feed, as `GET /v1/feed` gives it. */
export const feedPage: FeedPage = {
  schemaVersion: 1,
  items: feed.map((post) => ({ type: 'post', id: post.id, post })),
  nextCursor: null,
  head: null,
};

/** People suggested with their reasons, in the keys of the discovery namespace. */
const SUGGESTED: { member: MemberCard; key: string; params: Record<string, string> }[] = [
  {
    member: members.nadia,
    key: 'reasons.shared_sector',
    params: { sector: 'energy', name: members.nadia.displayName },
  },
  {
    member: members.kofi,
    key: 'reasons.mentoring_available',
    params: { name: members.kofi.displayName },
  },
  {
    member: members.ifeoma,
    key: 'reasons.mentoring_available',
    params: { name: members.ifeoma.displayName },
  },
];

export const suggestions: Suggestion[] = SUGGESTED.map(({ member, key, params }) => ({
  candidate: personCard(member),
  score: 40,
  sentence: { key: 'sentences.one', clauses: [{ key, params }] },
  reasons: [],
  rulesVersion: 1,
}));

export const project: ProjectCard = {
  id: '0192f4a0-3000-7000-8000-000000000001',
  slug: 'ferme-solaire-thies',
  title: 'Ferme solaire coopérative de Thiès',
  summary: 'Électricité stable pour trois villages et une école, gérée par une coopérative locale.',
  status: 'funding',
  sectorCode: 'energy',
  countryCodes: ['SN'],
  coverImageUrl: null,
  owner: members.aissatou,
  organization: null,
  funding: {
    goal: { amountMinor: '2000000', currency: 'EUR' },
    collected: { amountMinor: '1250000', currency: 'EUR' },
    progressPercent: 62,
    contributionCount: 148,
    daysLeft: 12,
    instruments: ['donation', 'reward_crowdfunding'],
    opensCapital: false,
  },
  impact: { selfDeclared: true, score: 78, level: 'strong', methodologyVersion: 1 },
  featured: false,
  publishedAt: at('2026-09-02T09:00:00Z'),
  endsAt: at('2026-10-20T23:59:00Z'),
};

export const tiers: ProjectTier[] = [
  ['5000', '500000', 'Étude de sol et raccordement', true],
  ['12000', '1200000', '120 panneaux et leurs onduleurs', true],
  ['20000', '2000000', 'Formation de vingt techniciennes et techniciens', false],
].map(([, amountMinor, description, unlocked], index) => ({
  id: `0192f4a0-3100-7000-8000-00000000000${index + 1}`,
  position: index + 1,
  threshold: { amountMinor: String(amountMinor), currency: 'EUR' },
  description: String(description),
  unlocked: Boolean(unlocked),
  unlockedAt: unlocked ? at(`2026-09-${10 + index * 10}T12:00:00Z`) : null,
}));

const POST_TARGET = {
  type: 'post',
  key: '0192f4a0-2000-7000-8000-000000000002',
  path: '/posts/0192f4a0-2000-7000-8000-000000000002',
} as const;

function notification(
  id: string,
  type: Notification['type'],
  actors: MemberCard[],
  actorCount: number,
  hours: number,
  read: boolean,
  extra: Partial<Pick<Notification, 'data' | 'excerpt' | 'target'>> = {},
): Notification {
  return {
    id,
    type,
    priority: 'normal',
    actors,
    actorCount,
    eventCount: actorCount,
    target: POST_TARGET,
    data: {},
    excerpt: null,
    read,
    createdAt: hoursAgo(hours),
    updatedAt: hoursAgo(hours),
    ...extra,
  };
}

const EXCERPT =
  'Nous ouvrons un fonds d’amorçage pour des projets d’énergie solaire au Sahel. Critères : équipe locale, prototype en service, premiers clients…';

export const notifications: Notification[] = [
  notification(
    '0192f4a0-4000-7000-8000-000000000001',
    'reaction',
    [members.kofi, members.nadia, members.jean],
    13,
    1,
    false,
    { data: { reaction: 'bravo', on: 'post' }, excerpt: EXCERPT },
  ),
  notification(
    '0192f4a0-4000-7000-8000-000000000002',
    'connection_request',
    [members.ifeoma],
    1,
    3,
    false,
    {
      target: { type: 'connection_requests', key: 'received', path: '/network/requests' },
      data: { requestId: '0192f4a0-4100-7000-8000-000000000001' },
    },
  ),
  notification('0192f4a0-4000-7000-8000-000000000003', 'comment', [members.nadia], 1, 7, false, {
    data: { commentId: '0192f4a0-4200-7000-8000-000000000001', reply: false },
    excerpt: EXCERPT,
  }),
  notification(
    '0192f4a0-4000-7000-8000-000000000004',
    'new_follower',
    [members.jean],
    1,
    30,
    true,
    {
      target: { type: 'member', key: members.jean.handle, path: `/members/${members.jean.handle}` },
    },
  ),
];

const conversationId = '0192f4a0-5000-7000-8000-000000000001';
/** The instant the compositions are seen at (their relative dates are computed from it). */
export const STORY_NOW = new Date(Date.UTC(2026, 9, 8, 12));
function message(sequence: number, mine: boolean, body: string, hours: number): Message {
  return {
    id: `0192f4a0-5100-7000-8000-00000000000${sequence}`,
    conversationId,
    sequence,
    clientMessageId: `client-${sequence}`,
    kind: 'text',
    senderHandle: mine ? members.aissatou.handle : members.kofi.handle,
    mine,
    body,
    attachments: [],
    sharedPost: null,
    edited: false,
    deleted: false,
    moderationStatus: 'visible',
    createdAt: hoursAgo(hours),
    editedAt: null,
  };
}

/** Two days of a conversation, with consecutive messages of one author close together. */
export const thread: Message[] = [
  message(1, false, 'Bonjour Aïssatou, j’ai lu le dossier de la ferme solaire.', 26),
  message(2, false, 'Votre plan de trésorerie couvre-t-il la maintenance des onduleurs ?', 25.95),
  message(3, true, 'Bonjour Kofi, merci ! Oui, une provision mensuelle est prévue.', 5),
  message(4, true, 'Mais je veux bien votre regard sur les hypothèses.', 4.97),
  message(
    5,
    false,
    'Avec plaisir. Envoyez-moi le tableau, je peux en parler jeudi après l’atelier.',
    4,
  ),
  message(6, true, 'Parfait, je vous l’envoie ce soir.', 1),
];

/** Kofi has read up to the last message of Aïssatou. */
export const threadReadBy = 6;

export const adminMembers: MemberSummary[] = [
  ['aissatou.ba', 'Aïssatou Ba', ['member'], true, '2026-09-01'],
  ['kofi.mensah', 'Kofi Mensah', ['member'], false, '2026-09-03'],
  ['claudine.pierre.louis', 'Claudine Pierre-Louis', ['member', 'moderator'], true, '2026-08-21'],
  ['nadia.benali', 'Nadia Benali', ['member'], true, '2026-09-12'],
  ['moussa.diop', 'Moussa Diop', ['member'], true, '2026-09-18'],
  ['ifeoma.okafor', 'Ifeoma Okafor', ['member'], true, '2026-10-02'],
].map(([login, name, roles, emailVerified, day], index) => ({
  userId: `0192f4a0-6000-7000-8000-00000000000${index + 1}`,
  email: `${String(login)}@demo.pitchorium.test`,
  name: String(name),
  handle: String(login).replaceAll('.', '-'),
  roles: roles as MemberSummary['roles'],
  emailVerified: Boolean(emailVerified),
  createdAt: at(`${String(day)}T10:00:00Z`),
}));

/** An abstract picture (gradient and circles, no text), inline: no file to serve. */
function picture(hue: number, width = 1200, height = 800): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},60%,45%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},60%,28%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${width * 0.3}" cy="${height * 0.6}" r="${height * 0.3}" fill="hsl(${(hue + 120) % 360},70%,65%)" fill-opacity="0.45"/><circle cx="${width * 0.75}" cy="${height * 0.3}" r="${height * 0.2}" fill="hsl(${(hue + 200) % 360},70%,70%)" fill-opacity="0.4"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const ALTS = [
  'Rangées de salades sous des panneaux solaires, au lever du jour.',
  'Une maraîchère ouvre la vanne d’une pompe solaire.',
  'Le bassin de la coopérative, rempli à ras bord.',
  'Des cagettes de tomates prêtes pour le marché.',
  'L’équipe de la coopérative devant le local technique.',
  'Le carnet partagé des pannes, ouvert sur une table.',
];

function postImages(count: number, hue: number, described = true): Post['images'] {
  return Array.from({ length: count }, (_, index) => {
    const url = picture((hue + index * 37) % 360);
    return {
      mediaId: `0192f4a0-2600-7000-8000-${String(hue * 10 + index).padStart(12, '0')}`,
      url,
      variants: {
        large: { width: 1200, height: 800, webp: url, avif: null },
        medium: { width: 1200, height: 800, webp: url, avif: null },
      },
      alt: described ? (ALTS[index % ALTS.length] ?? null) : null,
    };
  });
}

const variant = (
  n: number,
  author: MemberCard,
  text: string,
  fields: Partial<Post> = {},
): Post => ({
  ...post(`0192f4a0-2500-7000-8000-${String(n).padStart(12, '0')}`, author, text, n * 3, 8 + n),
  ...fields,
});

/** A publication with its text cut, a mention, an image and an edit. */
export const longPost: Post = variant(
  1,
  members.aissatou,
  [
    'Six mois après l’installation de la pompe solaire, la coopérative arrose deux fois plus de parcelles avec la même eau.',
    'Ce qui a marché : former deux techniciennes du village, garder un stock de pièces à Thiès, tenir un carnet partagé des pannes.',
    'Ce qui reste difficile : le financement du stockage, et le transport des récoltes pendant la saison des pluies.',
    'Merci à @kofi-mensah pour ses conseils sur le plan de trésorerie.',
  ].join('\n\n'),
  {
    mentions: [
      { token: '@kofi-mensah', type: 'member', key: 'kofi-mensah', displayName: 'Kofi Mensah' },
    ],
    images: postImages(1, 30),
    editedAt: hoursAgo(1),
  },
);

/** A publication of the reader with five images, for the viewer and the statistics. */
export const galleryPost: Post = variant(
  4,
  members.aissatou,
  'La tournée des coopératives en cinq images.',
  { images: postImages(5, 200), viewerIsAuthor: true, commentCount: 4 },
);

/** The first page of a feed with every kind of entry the web draws. */
export const feedVariantsPage: FeedPage = {
  schemaVersion: 1,
  head: null,
  nextCursor: null,
  items: [
    { type: 'post', id: 'post:1', post: longPost },
    {
      type: 'featured',
      id: 'featured:9',
      post: variant(9, members.jean, 'Trois projets agricoles à suivre cette saison.', {
        featured: true,
      }),
    },
    {
      type: 'post',
      id: 'post:2',
      post: variant(2, members.kofi, 'Deux images de l’atelier d’Accra.', {
        images: postImages(2, 90),
      }),
    },
    {
      type: 'post',
      id: 'post:3',
      post: variant(3, members.nadia, 'Trois dossiers retenus cette semaine.', {
        images: postImages(3, 150, false),
        visibility: 'members',
      }),
    },
    { type: 'post', id: 'post:4', post: galleryPost },
    {
      type: 'post',
      id: 'post:5',
      post: variant(5, members.jean, 'Notre rapport de saison, avant la réunion de jeudi.', {
        document: {
          mediaId: '0192f4a0-2700-7000-8000-000000000001',
          thumbnailUrl: picture(260, 480, 640),
          pageCount: 12,
          title: 'Rapport de saison 2026',
        },
        visibility: 'connections',
      }),
    },
    {
      type: 'post',
      id: 'post:6',
      post: variant(6, members.ifeoma, 'À lire sur l’irrigation solaire.', {
        link: {
          url: 'https://sahel.example/irrigation',
          status: 'ready',
          title: 'Irrigation solaire à Thiès',
          description: 'Une coopérative de quarante maraîchères arrose ses parcelles au soleil.',
          siteName: 'Sahel Agri',
          imageUrl: picture(45),
        },
      }),
    },
    {
      type: 'repost',
      id: 'repost:7',
      post: variant(7, members.nadia, 'À lire, surtout la partie sur le stockage.', {
        kind: 'repost',
        repostOf: variant(8, members.kofi, 'Le rapport annuel du club est en ligne.'),
      }),
    },
    {
      type: 'project_update',
      id: 'project_update:1',
      update: {
        id: '0192f4a0-2800-7000-8000-000000000001',
        projectId: project.id,
        author: members.aissatou,
        text: 'Premier palier atteint : la pompe est commandée.',
        images: [],
        publishedAt: hoursAgo(30),
        editedAt: null,
        project: {
          id: project.id,
          slug: project.slug,
          title: project.title,
          coverImageUrl: null,
        },
      },
    },
    {
      type: 'post',
      id: 'post:10',
      post: variant(10, members.aissatou, 'Une publication que la modération a masquée.', {
        viewerIsAuthor: true,
        moderation: 'hidden',
      }),
    },
  ],
};

function comment(
  n: number,
  author: MemberCard,
  text: string,
  fields: Partial<Comment> = {},
): Comment {
  return {
    id: `0192f4a0-2900-7000-8000-${String(n).padStart(12, '0')}`,
    postId: galleryPost.id,
    parentId: null,
    author,
    text,
    mentions: [],
    reactions: {
      counts: { like: n % 3, bravo: 0, insightful: n % 2, support: 0 },
      total: (n % 3) + (n % 2),
      viewerReaction: null,
    },
    replyCount: 0,
    viewerIsAuthor: false,
    viewerCanDelete: true,
    createdAt: hoursAgo(10 - n),
    editedAt: null,
    ...fields,
  };
}

/** The first page of the comments of the gallery, one of them answered. */
export const galleryComments: CursorPage<Comment> = {
  nextCursor: null,
  items: [
    comment(1, members.kofi, 'Quel délai de retour sur investissement pour une coopérative ?', {
      replyCount: 1,
    }),
    comment(2, members.nadia, 'Bravo à toute l’équipe, la Fondation suit ce projet.', {
      editedAt: hoursAgo(2),
    }),
    comment(3, members.jean, 'Le stockage reste le point dur, nous en parlons jeudi ?'),
  ],
};

/** A week of views of the gallery, for its author. */
export const galleryStats: PostStats = {
  postId: galleryPost.id,
  days: [3, 5, 8, 6, 9, 12, 7].map((uniqueViewers, index) => ({
    day: `2026-10-0${index + 2}`,
    uniqueViewers,
  })),
};
