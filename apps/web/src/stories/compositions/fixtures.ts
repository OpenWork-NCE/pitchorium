import type {
  Counters,
  DiscoveryCard,
  CurrentUser,
  MemberCard,
  MemberSummary,
  Message,
  Notification,
  Post,
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
