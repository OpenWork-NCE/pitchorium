import type { INestApplicationContext } from '@nestjs/common';
import type { NotificationType } from '@pitchorium/contracts';
import { ConversationsService } from '../../src/modules/messaging/application/conversations.service';
import { IntroductionsService } from '../../src/modules/messaging/application/introductions.service';
import { MessagingRepository } from '../../src/modules/messaging/application/ports';
import { directKeyOf } from '../../src/modules/messaging/domain/conversation';
import { NotificationsFacade } from '../../src/modules/notifications';
import { NotificationReadsService } from '../../src/modules/notifications/application/notification-reads.service';
import type { FixedClock } from '../../src/platform/kernel/clock';
import { slugBaseFromTitle } from '../../src/modules/projects/domain/project';
import { DEMO_MEMBERS } from './dataset';
import { DEMO_PROJECTS } from './projects-dataset';
import { demoId, type PendingImage } from './seed-dev-data';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** The address of a demonstration project, as seed-dev-projects.ts gives it. */
function projectSlug(key: string): string {
  const project = DEMO_PROJECTS.find((candidate) => candidate.key === key);
  return project ? slugBaseFromTitle(project.title) : key;
}
const projectTitle = (key: string) =>
  DEMO_PROJECTS.find((candidate) => candidate.key === key)?.title ?? key;

export interface DevMessagingResult {
  conversations: number;
  messages: number;
  requests: number;
  introductions: number;
  notifications: number;
  /** Files of messages, uploaded after the services (no storage call in a transaction). */
  attachments: (PendingImage & { ownerId: string })[];
}

/**
 * The long conversation of Kofi and Aïssatou (PROMPT FRONT 6): several days, enough messages to
 * read older ones by scrolling up, then a photo, a PDF and a shared publication.
 */
const LONG_THREAD: readonly (readonly [string, string])[] = [
  ['kofi', 'Comment se passe la mise en service des nouvelles pompes ?'],
  ['aissatou', 'Deux sur trois tournent, la troisième attend une pièce de Dakar.'],
  ['kofi', 'Tu as un fournisseur de secours si la pièce tarde ?'],
  ['aissatou', 'Oui, à Thiès, plus cher mais livré en deux jours.'],
  ['kofi', 'Garde la différence de prix dans ton tableau de trésorerie.'],
  ['aissatou', 'C’est noté, je l’ajoute ce soir.'],
  ['kofi', 'As-tu pu parler à la coopérative de Mboro pour le transport ?'],
  ['aissatou', 'Rendez-vous jeudi, ils proposent deux camions par semaine.'],
  ['kofi', 'Bien. Pense au contrat écrit, même court.'],
  ['aissatou', 'Je te l’envoie avant de signer.'],
];

/** Conversations between connected demo members: [from, to, text][]. */
const CONVERSATIONS: readonly (readonly [string, string, string])[][] = [
  [
    [
      'kofi',
      'aissatou',
      'Aïssatou, ton bilan de la saison sèche est impressionnant. Tu as un moment jeudi ?',
    ],
    ['aissatou', 'kofi', 'Avec plaisir ! Jeudi 10 h, heure de Dakar ?'],
    ['kofi', 'aissatou', 'Parfait. Je t’envoie le modèle de location-vente avant.'],
    ['aissatou', 'kofi', 'Merci Kofi, à jeudi.'],
  ],
  [
    ['samuel', 'ama', 'Ama, nous cherchons un partenaire logistique pour Kumasi.'],
    [
      'ama',
      'samuel',
      'Je te mets en relation avec notre transporteur, il livre déjà nos tisserands.',
    ],
  ],
];

/**
 * Message requests out of network (second degree): accepted, pending and declined
 * (silently), with the policy by default.
 */
const REQUESTS: readonly {
  from: string;
  to: string;
  text: string;
  answer: 'accept' | 'decline' | null;
}[] = [
  {
    from: 'jeanbaptiste',
    to: 'aissatou',
    text: 'Bonjour Aïssatou, nos planteurs de Soubré s’intéressent à l’irrigation solaire.',
    answer: 'accept',
  },
  {
    from: 'grace',
    to: 'kofi',
    text: 'Bonjour Kofi, Ama m’a parlé de vos conseils aux coopératives.',
    answer: null,
  },
  {
    from: 'samuel',
    to: 'aissatou',
    text: 'Bonjour, je propose des services de transport frigorifique.',
    answer: 'decline',
  },
];

/** Notifications grouped or alone, as the worker would create them from events. */
const NOTIFICATIONS: readonly {
  source: string;
  type: NotificationType;
  recipient: string;
  actor: string | null;
  target: { type: 'post' | 'member' | 'profile_views' | 'project'; key: string };
  data?: Record<string, string | number>;
  extraActors?: { ids: string[]; count: number };
}[] = [
  // « Kofi, Nadia et Thierry ont réagi à votre publication »: one notification.
  ...['kofi', 'nadia', 'thierry'].map((actor) => ({
    source: `demo:reaction:sahel-harvest:${actor}`,
    type: 'reaction' as const,
    recipient: 'aissatou',
    actor,
    target: { type: 'post' as const, key: demoId('post:sahel-harvest') },
    data: { reaction: 'bravo', on: 'post' },
  })),
  ...['moussa', 'samuel'].map((actor) => ({
    source: `demo:follower:kofi:${actor}`,
    type: 'new_follower' as const,
    recipient: 'kofi',
    actor,
    target: { type: 'member' as const, key: handleOf(actor) },
  })),
  {
    source: 'demo:comment:kente-launch',
    type: 'comment',
    recipient: 'ama',
    actor: 'kofi',
    target: { type: 'post', key: demoId('post:kente-launch') },
    data: { commentId: demoId('comment:kente-launch:demo') },
  },
  {
    source: 'demo:mention:sahel-harvest',
    type: 'mention',
    recipient: 'kofi',
    actor: 'aissatou',
    target: { type: 'post', key: demoId('post:sahel-harvest') },
  },
  // Projects and contributions: a contribution and an update of a followed project.
  {
    source: 'demo:contribution:thies',
    type: 'project_contribution',
    recipient: 'aissatou',
    actor: 'nadia',
    target: { type: 'project', key: projectSlug('pompes-thies') },
    data: { title: projectTitle('pompes-thies') },
  },
  {
    source: 'demo:update:soubre',
    type: 'project_update',
    recipient: 'aissatou',
    actor: 'jeanbaptiste',
    target: { type: 'project', key: projectSlug('sechoir-soubre') },
    data: { title: projectTitle('sechoir-soubre') },
  },
  {
    source: 'demo:profile-views',
    type: 'profile_views',
    recipient: 'aissatou',
    actor: null,
    target: { type: 'profile_views', key: 'demo' },
    data: { day: 'demo', count: 4 },
    extraActors: { ids: [userId('nadia'), userId('fatou')], count: 4 },
  },
];

function userId(key: string): string {
  return demoId(`member:${key}`);
}

function handleOf(key: string): string {
  return DEMO_MEMBERS.find((member) => member.key === key)?.handle ?? key;
}

/**
 * Conversations, message requests, a completed introduction and notifications, written
 * through the messaging services and the notifications facade (ADR 0035). Client message
 * identifiers and notification sources are fixed: a second run creates nothing.
 */
export async function seedDevMessaging(
  context: INestApplicationContext,
  clock: FixedClock,
  now: Date = new Date(),
): Promise<DevMessagingResult> {
  const get = <T>(type: abstract new (...args: never[]) => T): T =>
    context.get<T>(type, { strict: false });
  const conversations = get(ConversationsService);
  const introductions = get(IntroductionsService);
  const repository = get(MessagingRepository);
  const notifications = get(NotificationsFacade);
  const result: DevMessagingResult = {
    conversations: 0,
    messages: 0,
    requests: 0,
    introductions: 0,
    notifications: 0,
    attachments: [],
  };
  let at = now.getTime() - 3 * 24 * 60 * MINUTE_MS;
  const tick = () => {
    at += 17 * MINUTE_MS;
    clock.set(new Date(at));
  };
  const write = async (
    from: string,
    to: string,
    text: string,
    clientMessageId: string,
    sharedPostId?: string,
  ) => {
    tick();
    const sender = userId(from);
    const known = await repository.findByClientId(sender, clientMessageId);
    // Written by a previous run (its files attached since): nothing to send again.
    if (known) return;
    if (!(await repository.findDirect(directKeyOf(sender, userId(to))))) {
      result.conversations += 1;
    }
    await conversations.start(sender, {
      recipientHandle: handleOf(to),
      clientMessageId,
      body: text,
      attachmentIds: [],
      attachmentTexts: [],
      ...(sharedPostId ? { sharedPostId } : {}),
    });
    result.messages += 1;
  };

  // Several days of the long conversation, from a week ago, then its files and a shared
  // publication; every moment stays in the past.
  at = now.getTime() - 7 * DAY_MS;
  for (let round = 0; round < 4; round += 1) {
    at = now.getTime() - (7 - round) * DAY_MS;
    for (const [position, [from, text]] of LONG_THREAD.entries()) {
      await write(
        from,
        from === 'kofi' ? 'aissatou' : 'kofi',
        text,
        `demo-long-${round}-${position}`,
      );
    }
  }
  await write(
    'kofi',
    'aissatou',
    'La publication de ta récolte, à montrer au comité.',
    'demo-long-shared',
    demoId('post:sahel-harvest'),
  );
  await write(
    'aissatou',
    'kofi',
    'Voici la parcelle et le contrat de transport.',
    'demo-long-files',
  );
  const filesMessage = await repository.findByClientId(userId('aissatou'), 'demo-long-files');
  if (filesMessage && filesMessage.attachmentIds.length === 0) {
    const files = [
      {
        key: 'photo',
        kind: 'post' as const,
        text: 'Parcelle de Thiès irriguée par la pompe solaire',
      },
      { key: 'contract', kind: 'document' as const, text: 'Contrat de transport, Mboro' },
    ].map((file) => ({ ...file, id: demoId(`media:message:${file.key}`) }));
    await repository.updateMessage(filesMessage.id, {
      attachmentIds: files.map((file) => file.id),
      attachmentTexts: files.map((file) => file.text),
    });
    for (const file of files) {
      result.attachments.push({
        id: file.id,
        kind: file.kind,
        pages: 2,
        hue: 28,
        variant: 1,
        usage: 'message_attachment',
        visibility: 'private',
        resource: { type: 'message', id: filesMessage.id },
        ownerId: userId('aissatou'),
      });
    }
  }

  at = Math.max(at, now.getTime() - 3 * DAY_MS);

  for (const [index, thread] of CONVERSATIONS.entries()) {
    for (const [position, [from, to, text]] of thread.entries()) {
      await write(from, to, text, `demo-message-${index}-${position}`);
    }
  }

  for (const [index, request] of REQUESTS.entries()) {
    const existing = await repository.findDirect(
      directKeyOf(userId(request.from), userId(request.to)),
    );
    await write(request.from, request.to, request.text, `demo-request-${index}`);
    if (existing) continue;
    result.requests += 1;
    const conversation = await repository.findDirect(
      directKeyOf(userId(request.from), userId(request.to)),
    );
    if (!conversation || !request.answer) continue;
    tick();
    await conversations.respond(userId(request.to), conversation.id, request.answer === 'accept');
    if (request.answer === 'accept') {
      await write(
        request.to,
        request.from,
        'Avec plaisir, appelons-nous la semaine prochaine.',
        `demo-request-${index}-reply`,
      );
    }
  }

  // Aïssatou, connected to Nadia and Fatou, introduces them; both accept.
  const introducer = userId('aissatou');
  if ((await repository.introductions(introducer, null, 50)).length === 0) {
    tick();
    const proposed = await introductions.propose(introducer, {
      firstHandle: handleOf('nadia'),
      secondHandle: handleOf('fatou'),
      note: 'Nadia, Fatou cherche une experte en finance agricole pour sa prochaine levée : je pense que vous devriez vous parler.',
    });
    tick();
    await introductions.respond(userId('nadia'), proposed.id, true);
    tick();
    await introductions.respond(userId('fatou'), proposed.id, true);
    result.introductions += 1;
  }

  // Kofi introduces Aïssatou to Ama: Ama accepted, Aïssatou has to answer.
  const kofi = userId('kofi');
  const proposedByKofi = (await repository.introductions(kofi, null, 50)).filter(
    (introduction) => introduction.introducerId === kofi,
  );
  if (proposedByKofi.length === 0) {
    tick();
    const proposed = await introductions.propose(kofi, {
      firstHandle: handleOf('aissatou'),
      secondHandle: handleOf('ama'),
      note: 'Aïssatou, Ama vend des tissages à Kumasi et cherche des panneaux solaires pour son atelier.',
    });
    tick();
    await introductions.respond(userId('ama'), proposed.id, true);
    result.introductions += 1;
  }

  // Preferences of each kind: a daily digest and the copy of unread messages for Aïssatou, a
  // weekly digest for Kofi; Samuel writes to his connections only, Grace to any verified member.
  const preferences = get(NotificationReadsService);
  await preferences.updatePreferences(userId('aissatou'), {
    emailDigest: 'daily',
    changes: [
      { type: 'message', channel: 'email', enabled: true },
      { type: 'followed_post', channel: 'in_app', enabled: false },
    ],
  });
  await preferences.updatePreferences(userId('kofi'), { emailDigest: 'weekly', changes: [] });
  await conversations.updateSettings(userId('samuel'), { messagePolicy: 'connections_only' });
  await conversations.updateSettings(userId('grace'), { messagePolicy: 'verified_members' });

  for (const demo of NOTIFICATIONS) {
    tick();
    result.notifications += await notifications.notify(demo.source, {
      type: demo.type,
      recipientIds: [userId(demo.recipient)],
      actorId: demo.actor ? userId(demo.actor) : null,
      target: demo.target,
      data: demo.data ?? {},
      ...(demo.extraActors ? { extraActors: demo.extraActors } : {}),
    });
  }
  clock.set(now);
  return result;
}
