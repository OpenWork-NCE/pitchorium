import type { INestApplicationContext } from '@nestjs/common';
import type { NotificationType } from '@pitchorium/contracts';
import { ConversationsService } from '../../src/modules/messaging/application/conversations.service';
import { IntroductionsService } from '../../src/modules/messaging/application/introductions.service';
import { MessagingRepository } from '../../src/modules/messaging/application/ports';
import { directKeyOf } from '../../src/modules/messaging/domain/conversation';
import { NotificationsFacade } from '../../src/modules/notifications';
import type { FixedClock } from '../../src/platform/kernel/clock';
import { DEMO_MEMBERS } from './dataset';
import { demoId } from './seed-dev-data';

const MINUTE_MS = 60_000;

export interface DevMessagingResult {
  conversations: number;
  messages: number;
  requests: number;
  introductions: number;
  notifications: number;
}

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
  target: { type: 'post' | 'member' | 'profile_views'; key: string };
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
  };
  let at = now.getTime() - 3 * 24 * 60 * MINUTE_MS;
  const tick = () => {
    at += 17 * MINUTE_MS;
    clock.set(new Date(at));
  };
  const write = async (from: string, to: string, text: string, clientMessageId: string) => {
    tick();
    const sender = userId(from);
    const known = await repository.findByClientId(sender, clientMessageId);
    if (!known && !(await repository.findDirect(directKeyOf(sender, userId(to))))) {
      result.conversations += 1;
    }
    await conversations.start(sender, {
      recipientHandle: handleOf(to),
      clientMessageId,
      body: text,
      attachmentIds: [],
    });
    if (!known) result.messages += 1;
  };

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
