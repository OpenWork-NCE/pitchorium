// Messaging and notifications of the stub api (PROMPT FRONT 6): the conversations of the member
// (a long one over several days with files and shared publications, a group born of an
// introduction, a request received, an archived one), their messages by sequence, the
// introductions, the notifications of each family and their preferences, the unsubscribe of an
// email. Moments are fixed hours of today and the days before (UTC, the zone of the demo
// accounts), so that the screens read the same at every run. Every write is logged.
import { feedItems } from './stub-content.mjs';

const CONVERSATION = (n) => `0192f4a0-6000-7000-8000-${String(n).padStart(12, '0')}`;
const MESSAGE = (c, n) =>
  `0192f4a0-61${String(c).padStart(2, '0')}-7000-8000-${String(n).padStart(12, '0')}`;
const INTRODUCTION = (n) => `0192f4a0-6200-7000-8000-${String(n).padStart(12, '0')}`;
const NOTIFICATION = (n) => `0192f4a0-6300-7000-8000-${String(n).padStart(12, '0')}`;

const card = (handle, displayName, headline) => ({
  handle,
  displayName,
  headline,
  avatarUrl: null,
});
const KOFI = card('kofi-mensah', 'Kofi Mensah', 'Mentor finance, Accra');
const NADIA = card('nadia-benali', 'Nadia Benali', 'Investisseuse à impact, Paris');
const FATOU = card('fatou-sall', 'Fatou Sall', 'Entrepreneure, Thiès');
const GRACE = card('grace-wanjiru', 'Grace Wanjiru', 'Fondatrice, Kisumu');
const MOUSSA = card('moussa-diop', 'Moussa Diop', 'Agronome, Kaolack');

/** An instant `daysAgo` days before today (UTC), at `hour`:`minute`. */
function at(daysAgo, hour, minute) {
  const day = new Date();
  day.setUTCHours(hour, minute, 0, 0);
  day.setUTCDate(day.getUTCDate() - daysAgo);
  return day.toISOString();
}

const LINES = [
  ['kofi', 'Bonjour Aïssatou, j’ai relu ton plan de trésorerie de la saison sèche.'],
  ['me', 'Merci Kofi ! Qu’est-ce qui te paraît le plus fragile ?'],
  ['kofi', 'Le stock de pièces détachées : deux pompes en panne et tout le planning glisse.'],
  ['me', 'C’est vrai. Nous pensons garder trois kits complets à Thiès.'],
  ['kofi', 'Bonne idée. Et le transport des récoltes pendant l’hivernage ?'],
  ['me', 'Un accord avec la coopérative de Mboro, à confirmer cette semaine.'],
];

/** The long conversation with Kofi: 80 messages over four days, a PDF and two publications. */
function longThread(origin) {
  const posts = feedItems(origin, [KOFI, NADIA, MOUSSA], KOFI).flatMap((item) =>
    item.post ? [item.post] : [],
  );
  const messages = [];
  for (let index = 0; index < 80; index += 1) {
    const daysAgo = index < 20 ? 3 : index < 40 ? 2 : index < 64 ? 1 : 0;
    const position =
      index < 20 ? index : index < 40 ? index - 20 : index < 64 ? index - 40 : index - 64;
    const [author, text] = LINES[index % LINES.length];
    messages.push({
      author,
      body: index === 78 ? 'Je t’envoie la note de synthèse et la publication de Nadia.' : text,
      createdAt: at(daysAgo, 8 + Math.floor(position / 3), (position * 7) % 60),
      attachments:
        index === 79
          ? [
              {
                mediaId: '0192f4a0-6400-7000-8000-000000000001',
                image: null,
                text: 'Note de synthèse, saison sèche',
              },
            ]
          : [],
      sharedPost:
        index === 77
          ? { postId: posts[1].id, post: posts[1] }
          : index === 76
            ? // Out of the audience of the reader: the api gives the id only.
              { postId: '0192f4a0-2000-7000-8000-000000009999', post: null }
            : null,
    });
  }
  return messages;
}

function seed(origin) {
  const conversations = [
    {
      id: CONVERSATION(1),
      kind: 'direct',
      requestState: 'none',
      others: [KOFI],
      lines: longThread(origin),
      readBy: 79,
      box: 'inbox',
      unread: 2,
      muted: false,
    },
    {
      id: CONVERSATION(2),
      kind: 'group',
      requestState: 'none',
      others: [NADIA, FATOU],
      lines: [
        {
          author: 'nadia',
          kind: 'introduction',
          body: 'Fatou, Aïssatou cherche une experte en finance agricole : je pense que vous devriez vous parler.',
          createdAt: at(0, 9, 5),
        },
        {
          author: 'fatou',
          body: 'Merci Nadia ! Aïssatou, ravie de faire connaissance.',
          createdAt: at(0, 9, 31),
        },
      ],
      readBy: 2,
      box: 'inbox',
      unread: 0,
      muted: true,
    },
    {
      id: CONVERSATION(3),
      kind: 'direct',
      requestState: 'received',
      others: [GRACE],
      lines: [
        {
          author: 'grace',
          body: 'Bonjour Aïssatou, nos maraîchers de Kisumu s’intéressent à vos pompes en location.',
          createdAt: at(0, 7, 48),
        },
      ],
      readBy: 0,
      box: 'requests',
      unread: 1,
      muted: false,
    },
    {
      id: CONVERSATION(4),
      kind: 'direct',
      requestState: 'none',
      others: [MOUSSA],
      lines: [
        {
          author: 'moussa',
          body: 'Les semences sont arrivées à Kaolack.',
          createdAt: at(0, 6, 12),
        },
        { author: 'me', body: 'Parfait, merci Moussa.', createdAt: at(0, 6, 40) },
      ],
      readBy: 2,
      box: 'archived',
      unread: 0,
      muted: false,
    },
  ];
  const introductions = [
    {
      id: INTRODUCTION(1),
      role: 'first',
      introducer: KOFI,
      first: null,
      second: GRACE,
      note: 'Aïssatou, Grace équipe des maraîchers au Kenya : vos retours sur la location de pompes l’aideraient.',
      answers: { first: 'pending', second: 'accepted' },
      status: 'pending',
      conversationId: null,
      createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    },
    {
      id: INTRODUCTION(2),
      role: 'first',
      introducer: NADIA,
      first: null,
      second: FATOU,
      note: 'Fatou, Aïssatou cherche une experte en finance agricole : je pense que vous devriez vous parler.',
      answers: { first: 'accepted', second: 'accepted' },
      status: 'completed',
      conversationId: CONVERSATION(2),
      createdAt: at(1, 16, 20),
    },
  ];
  return {
    conversations,
    introductions,
    sent: [],
    notifications: notificationsOf(),
    digest: 'daily',
    preferences: new Map(),
  };
}

function notificationsOf() {
  const base = (n, type, actors, extra = {}) => ({
    id: NOTIFICATION(n),
    type,
    priority: 'normal',
    actors,
    actorCount: actors.length,
    eventCount: actors.length,
    data: {},
    excerpt: null,
    read: false,
    // Hours before now: « il y a 2 heures » reads the same at every run.
    createdAt: new Date(Date.now() - n * 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - n * 3_600_000).toISOString(),
    ...extra,
  });
  const post = '0192f4a0-2000-7000-8000-000000000001';
  return [
    base(1, 'reaction', [KOFI, NADIA, MOUSSA], {
      actorCount: 13,
      eventCount: 14,
      data: { reaction: 'bravo', on: 'post' },
      target: { type: 'post', key: post, path: `/posts/${post}` },
      excerpt:
        'Six mois après l’installation de la pompe solaire, la coopérative arrose deux fois plus…',
    }),
    base(2, 'connection_request', [GRACE], {
      data: { requestId: 'request-grace-wanjiru' },
      target: { type: 'connection_requests', key: 'connection_requests', path: '/network' },
    }),
    base(3, 'introduction_proposed', [KOFI], {
      target: {
        type: 'introduction',
        key: INTRODUCTION(1),
        path: `/introductions/${INTRODUCTION(1)}`,
      },
    }),
    base(4, 'mention', [MOUSSA], {
      target: { type: 'post', key: post, path: `/posts/${post}` },
      excerpt: 'Merci à @aissatou-ba pour la visite des parcelles de Thiès.',
    }),
    base(5, 'project_contribution', [NADIA], {
      data: { title: 'Pompes solaires de Thiès' },
      target: {
        type: 'project',
        key: 'ferme-solaire-thies',
        path: '/projects/ferme-solaire-thies',
      },
      read: true,
    }),
    base(6, 'message', [KOFI], {
      eventCount: 2,
      data: { count: 2 },
      target: { type: 'conversation', key: CONVERSATION(1), path: `/messages/${CONVERSATION(1)}` },
      read: true,
    }),
    base(7, 'moderation_decision', [], {
      target: { type: 'moderation_decision', key: 'd1', path: '/me/moderation/decisions/d1' },
      read: true,
    }),
  ];
}

const FAMILIES = {
  mentions: ['mention'],
  network: [
    'connection_request',
    'connection_accepted',
    'new_follower',
    'introduction_proposed',
    'introduction_completed',
    'profile_views',
  ],
  posts: ['reaction', 'comment', 'followed_post'],
  projects: ['project_contribution', 'tier_unlocked', 'project_update', 'project_team_invitation'],
};

/** Types of the grid of the preferences, a part of the registry of the api. */
const PREFERENCES = [
  ['connection_request', false, true, true],
  ['new_follower', false, true, false],
  ['introduction_proposed', false, true, true],
  ['reaction', false, true, false],
  ['comment', false, true, true],
  ['mention', false, true, true],
  ['message', false, true, false],
  ['project_contribution', false, true, true],
  ['project_update', false, true, false],
  ['organization_invitation', true, true, false],
  ['event_reminder', false, true, true],
  ['kyc_decided', true, true, true],
  ['security_alert', true, true, true],
  ['moderation_decision', true, true, true],
];

export function messagingRoutes({ origin, accounts, sessionOf, problem, readJson, state }) {
  const data = () => (state().messaging ??= seed(origin));
  const log = (route, email, extra = {}) =>
    state().writes.push({ route, email, ...extra, at: new Date().toISOString() });
  const meCard = (email) =>
    card(accounts[email].handle, accounts[email].name, accounts[email].headline);

  const messagesOf = (conversation, email) =>
    conversation.lines.map((line, index) => {
      const mine = line.author === 'me';
      const sender = mine
        ? meCard(email)
        : (conversation.others.find((other) => other.handle.startsWith(line.author)) ??
          conversation.others[0]);
      return {
        id: line.id ?? MESSAGE(Number(conversation.id.slice(-2)), index + 1),
        conversationId: conversation.id,
        sequence: index + 1,
        clientMessageId: line.clientMessageId ?? `seed-${conversation.id.slice(-4)}-${index + 1}`,
        kind: line.kind ?? 'text',
        senderHandle: sender.handle,
        mine,
        body: line.deleted ? null : line.body,
        attachments: line.deleted ? [] : (line.attachments ?? []),
        sharedPost: line.deleted ? null : (line.sharedPost ?? null),
        edited: false,
        deleted: Boolean(line.deleted),
        moderationStatus: 'visible',
        createdAt: line.createdAt,
        editedAt: null,
        editableUntil:
          mine && !line.deleted
            ? new Date(Date.parse(line.createdAt) + 15 * 60_000).toISOString()
            : null,
      };
    });

  const view = (conversation, email) => {
    const messages = messagesOf(conversation, email);
    const last = messages.at(-1) ?? null;
    return {
      id: conversation.id,
      kind: conversation.kind,
      requestState: conversation.requestState,
      participants: conversation.others.map((member) => ({
        member,
        lastReadSequence: conversation.readBy,
        left: false,
      })),
      lastMessage: last,
      lastSequence: messages.length,
      lastReadSequence: messages.length - conversation.unread,
      unreadCount: conversation.unread,
      markedUnread: Boolean(conversation.markedUnread),
      archived: conversation.box === 'archived',
      muted: conversation.muted,
      canSend: conversation.requestState !== 'sent',
      introductionId: conversation.kind === 'group' ? INTRODUCTION(2) : null,
      lastMessageAt: last?.createdAt ?? at(0, 0, 0),
      createdAt: messages[0]?.createdAt ?? at(0, 0, 0),
    };
  };

  return function messaging(request, path, url) {
    const method = request.method;
    const touches =
      path.startsWith('/v1/messaging') ||
      path.startsWith('/v1/me/messaging') ||
      path.startsWith('/v1/me/notification') ||
      path.startsWith('/v1/notifications/');
    if (!touches) return null;
    if (path === '/v1/notifications/unsubscribe' && method === 'POST') {
      const token = url.searchParams.get('token') ?? '';
      if (!token.startsWith('stub-')) return problem(400, 'NOTIFICATIONS_UNSUBSCRIBE_INVALID');
      log('unsubscribe', null, { token });
      return token === 'stub-digest-token-0001'
        ? { status: 200, body: { scope: 'digest', previousDigest: 'daily' } }
        : { status: 200, body: { scope: 'message', previousDigest: null } };
    }
    if (path === '/v1/notifications/resubscribe' && method === 'POST') {
      log('resubscribe', null, { token: url.searchParams.get('token') });
      return { status: 200, body: { scope: 'message', previousDigest: null } };
    }
    const email = sessionOf(request);
    if (!email) return problem(401, 'UNAUTHENTICATED');
    const store = data();
    return (async () => {
      if (path === '/v1/messaging/conversations' && method === 'GET') {
        const box = url.searchParams.get('box') ?? 'inbox';
        const q = (url.searchParams.get('q') ?? '').toLowerCase();
        const items = store.conversations
          .filter((conversation) => conversation.box === box)
          .filter(
            (conversation) => url.searchParams.get('unread') !== 'true' || conversation.unread > 0,
          )
          .filter(
            (conversation) =>
              !q ||
              conversation.others.some((other) => other.displayName.toLowerCase().includes(q)),
          )
          .map((conversation) => view(conversation, email))
          .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
        return { status: 200, body: { items, nextCursor: null } };
      }
      if (path === '/v1/messaging/conversations' && method === 'POST') {
        const body = await readJson(request);
        log('message-start', email, { key: request.headers['idempotency-key'] ?? null, ...body });
        const other =
          [KOFI, NADIA, FATOU, GRACE, MOUSSA].find(
            (member) => member.handle === body.recipientHandle,
          ) ?? card(body.recipientHandle, body.recipientHandle, null);
        const conversation = {
          id: CONVERSATION(10 + store.conversations.length),
          kind: 'direct',
          requestState: 'sent',
          others: [other],
          lines: [
            {
              author: 'me',
              body: body.body,
              createdAt: new Date().toISOString(),
              clientMessageId: body.clientMessageId,
            },
          ],
          readBy: 0,
          box: 'inbox',
          unread: 0,
          muted: false,
        };
        store.conversations.push(conversation);
        return { status: 201, body: messagesOf(conversation, email)[0] };
      }
      const member = /^\/v1\/messaging\/members\/([\w-]+)$/.exec(path);
      if (member && method === 'GET') {
        const existing = store.conversations.find(
          (conversation) =>
            conversation.kind === 'direct' && conversation.others[0].handle === member[1],
        );
        return {
          status: 200,
          body: {
            conversationId: existing?.id ?? null,
            // Koffi Agbodjan accepts his connections only; Claudine is out of the network.
            mode:
              member[1] === 'kofi-mensah'
                ? 'direct'
                : member[1] === 'koffi-agbodjan'
                  ? 'refused'
                  : 'request',
            missing: [],
          },
        };
      }
      const one = /^\/v1\/messaging\/conversations\/([\w-]+)(\/[\w-]+)?$/.exec(path);
      const conversation = one
        ? store.conversations.find((candidate) => candidate.id === one[1])
        : undefined;
      if (one && !conversation) return problem(404, 'MESSAGING_CONVERSATION_NOT_FOUND');
      if (one && conversation) {
        const action = one[2];
        if (!action && method === 'GET') return { status: 200, body: view(conversation, email) };
        if (!action && method === 'PATCH') {
          const change = await readJson(request);
          if (change.archived !== undefined)
            conversation.box = change.archived ? 'archived' : 'inbox';
          if (change.muted !== undefined) conversation.muted = change.muted;
          if (change.unread !== undefined) conversation.markedUnread = change.unread;
          log('conversation-update', email, change);
          return { status: 200, body: view(conversation, email) };
        }
        if (action === '/messages' && method === 'GET') {
          const all = messagesOf(conversation, email);
          const limit = Number(url.searchParams.get('limit') ?? 50);
          const before = url.searchParams.get('beforeSequence');
          const after = url.searchParams.get('afterSequence');
          let items;
          let hasMore;
          if (before) {
            const older = all.filter((message) => message.sequence < Number(before));
            items = older.slice(-limit);
            hasMore = older.length > limit;
          } else if (after) {
            const newer = all.filter((message) => message.sequence > Number(after));
            items = newer.slice(0, limit);
            hasMore = newer.length > limit;
          } else {
            items = all.slice(-limit);
            hasMore = all.length > limit;
          }
          return { status: 200, body: { items, lastSequence: all.length, hasMore } };
        }
        if (action === '/messages' && method === 'POST') {
          const body = await readJson(request);
          const key = request.headers['idempotency-key'] ?? null;
          const replay = conversation.lines.some(
            (line) => line.clientMessageId === body.clientMessageId,
          );
          log('message', email, { key, replay, clientMessageId: body.clientMessageId });
          if (!replay) {
            conversation.lines.push({
              author: 'me',
              body: body.body,
              createdAt: new Date().toISOString(),
              clientMessageId: body.clientMessageId,
              sharedPost: body.sharedPostId ? { postId: body.sharedPostId, post: null } : null,
              attachments: (body.attachmentIds ?? []).map((mediaId, index) => ({
                mediaId,
                image: null,
                text: body.attachmentTexts?.[index] ?? null,
              })),
            });
          }
          const message = messagesOf(conversation, email).find(
            (candidate) => candidate.clientMessageId === body.clientMessageId,
          );
          return { status: 201, body: message };
        }
        if (action === '/read' && method === 'POST') {
          const { sequence } = await readJson(request);
          conversation.unread = 0;
          return { status: 200, body: { sequence } };
        }
        if ((action === '/accept' || action === '/decline') && method === 'POST') {
          log(`request-${action.slice(1)}`, email);
          if (action === '/accept') {
            conversation.requestState = 'none';
            conversation.box = 'inbox';
          } else {
            store.conversations = store.conversations.filter(
              (candidate) => candidate !== conversation,
            );
          }
          return { status: 204, body: null };
        }
      }
      if (path === '/v1/messaging/introductions' && method === 'GET') {
        return {
          status: 200,
          body: {
            items: store.introductions.map((item) => ({ ...item, first: meCard(email) })),
            nextCursor: null,
          },
        };
      }
      const introduction = /^\/v1\/messaging\/introductions\/([\w-]+)(\/accept|\/decline)?$/.exec(
        path,
      );
      if (introduction) {
        const found = store.introductions.find((item) => item.id === introduction[1]);
        if (!found) return problem(404, 'MESSAGING_INTRODUCTION_NOT_FOUND');
        if (introduction[2] && method === 'POST') {
          log(`introduction${introduction[2].replace('/', '-')}`, email, { id: found.id });
          found.answers.first = introduction[2] === '/accept' ? 'accepted' : 'declined';
          found.status = introduction[2] === '/accept' ? 'completed' : 'declined';
          return { status: 204, body: null };
        }
        return { status: 200, body: { ...found, first: meCard(email) } };
      }
      if (path === '/v1/messaging/introductions' && method === 'POST') {
        log('introduction', email, await readJson(request));
        return {
          status: 201,
          body: { ...store.introductions[0], id: INTRODUCTION(9), role: 'introducer' },
        };
      }
      if (path === '/v1/me/messaging/settings') {
        if (method === 'PUT') {
          const body = await readJson(request);
          store.policy = body.messagePolicy;
          log('messaging-settings', email, body);
        }
        return {
          status: 200,
          body: { messagePolicy: store.policy ?? 'connections_and_second_degree' },
        };
      }
      if (path === '/v1/me/notifications' && method === 'GET') {
        const family = url.searchParams.get('family');
        const items = store.notifications.filter(
          (item) => !family || FAMILIES[family]?.includes(item.type),
        );
        return { status: 200, body: { items, nextCursor: null } };
      }
      const notification = /^\/v1\/me\/notifications\/([\w-]+)(\/read)?$/.exec(path);
      if (notification) {
        const found = store.notifications.find((item) => item.id === notification[1]);
        if (!found) return problem(404, 'NOTIFICATIONS_NOT_FOUND');
        log(notification[2] ? 'notification-read' : 'notification-delete', email, { id: found.id });
        if (notification[2]) found.read = true;
        else store.notifications = store.notifications.filter((item) => item !== found);
        return { status: 204, body: null };
      }
      if (path === '/v1/me/notification-preferences') {
        if (method === 'PATCH') {
          const body = await readJson(request);
          log('notification-preferences', email, body);
          if (body.emailDigest) store.digest = body.emailDigest;
          for (const change of body.changes ?? []) {
            store.preferences.set(`${change.type}:${change.channel}`, change.enabled);
          }
        }
        return {
          status: 200,
          body: {
            emailDigest: store.digest,
            types: PREFERENCES.map(([type, transactional, inApp, email]) => ({
              type,
              transactional,
              channels: {
                in_app: store.preferences.get(`${type}:in_app`) ?? inApp,
                email: store.preferences.get(`${type}:email`) ?? email,
              },
            })),
            digestSchedule: { hour: 8, weeklyDay: 'monday', timeZone: 'Africa/Dakar' },
          },
        };
      }
      return null;
    })();
  };
}
