import type { INestApplicationContext } from '@nestjs/common';
import type { ReactionType } from '@pitchorium/contracts';
import { ContentFacade } from '../../src/modules/content';
import { CommentsService } from '../../src/modules/content/application/comments.service';
import { ContentEventsRecorder } from '../../src/modules/content/application/content-events.recorder';
import { ContentMaintenanceService } from '../../src/modules/content/application/content-maintenance.service';
import { ContentRepository, PostViewCounter } from '../../src/modules/content/application/ports';
import { PostsService } from '../../src/modules/content/application/posts.service';
import { ReactionsService } from '../../src/modules/content/application/reactions.service';
import { SafeLinkPageFetcher } from '../../src/modules/content/infrastructure/safe-link-page.fetcher';
import { MediaFacade } from '../../src/modules/media';
import { ProfilesFacade } from '../../src/modules/profiles';
import { parseWorkerConfig } from '../../src/platform/config/config';
import { TransactionManager } from '../../src/platform/database';
import { SafeHttpClient } from '../../src/platform/outbound/safe-http-client';
import type { FixedClock } from '../../src/platform/kernel/clock';
import { DEMO_MEMBERS } from './dataset';
import { demoId } from './seed-dev-data';

const DAY_MS = 86_400_000;

export interface DevContentResult {
  discussionComments: number;
  discussionReactions: number;
  savedPosts: number;
  viewDays: number;
  hiddenPosts: number;
}

/** A long discussion: top-level comments and their replies (one level), some with a mention. */
const DISCUSSION: readonly { key: string; author: string; text: string; replyTo?: string }[] = [
  {
    key: 'd1',
    author: 'thierry',
    text: 'Nous couvrons le risque de change par des tickets en euros et des remboursements indexés.',
  },
  {
    key: 'd2',
    author: 'kofi',
    text: 'Indexed on what, the official rate or the parallel one?',
    replyTo: 'd1',
  },
  { key: 'd3', author: 'thierry', text: 'Le taux officiel, revu chaque trimestre.', replyTo: 'd1' },
  {
    key: 'd4',
    author: 'samuel',
    text: 'Mobile money corridors change the picture: settlement in hours, not weeks.',
  },
  {
    key: 'd5',
    author: 'ama',
    text: 'Agreed, our payouts settle the same day. @samuel-okafor do you hedge at all?',
    replyTo: 'd4',
  },
  {
    key: 'd6',
    author: 'samuel',
    text: 'Only on the treasury we keep in dollars.',
    replyTo: 'd4',
  },
  {
    key: 'd7',
    author: 'fatou',
    text: 'Pour les coopératives, la question du prix d’achat compte autant que celle du change.',
  },
  {
    key: 'd8',
    author: 'aissatou',
    text: 'Exactement : nos mensualités suivent les récoltes, pas le calendrier.',
    replyTo: 'd7',
  },
  {
    key: 'd9',
    author: 'jeanbaptiste',
    text: 'Le cacao est payé en dollars, nos coûts en francs CFA : la parité fixe nous protège en partie.',
  },
  {
    key: 'd10',
    author: 'moussa',
    text: 'Merci pour ce fil, très utile pour préparer notre dossier.',
  },
  {
    key: 'd11',
    author: 'grace',
    text: 'In Nairobi we price in shillings and report in dollars to our funders.',
  },
  {
    key: 'd12',
    author: 'claudine',
    text: 'Même question aux Antilles avec l’euro : le risque est ailleurs, sur les délais de paiement.',
  },
  {
    key: 'd13',
    author: 'kofi',
    text: 'Good point, working capital is the hidden risk.',
    replyTo: 'd12',
  },
];

/** Reactions to the comments of the discussion. */
const DISCUSSION_REACTIONS: readonly { comment: string; author: string; type: ReactionType }[] = [
  { comment: 'd1', author: 'kofi', type: 'insightful' },
  { comment: 'd1', author: 'fatou', type: 'like' },
  { comment: 'd4', author: 'ama', type: 'insightful' },
  { comment: 'd4', author: 'grace', type: 'like' },
  { comment: 'd8', author: 'nadia', type: 'support' },
  { comment: 'd9', author: 'thierry', type: 'insightful' },
  { comment: 'd12', author: 'thierry', type: 'bravo' },
];

/** Viewers of the publications of Aïssatou over the last week, day by day (statistics). */
const VIEWERS_PER_DAY = [3, 5, 8, 6, 9, 12, 7];

/**
 * The publications as the pages of PROMPT FRONT 4 show them, through the services of content
 * (ADR 0035): a long discussion with replies, mentions and reactions on a public publication,
 * publications saved by Aïssatou, a week of views for the statistics of her publications, and a
 * publication hidden by the moderation (seen by its author with a notice). The images, the
 * document and the link previews are in `seedDevData`: a service only accepts processed files.
 * Skipped when the discussion exists.
 */
export async function seedDevContent(
  context: INestApplicationContext,
  clock: FixedClock,
  now: Date = new Date(),
): Promise<DevContentResult> {
  const get = <T>(type: abstract new (...args: never[]) => T): T =>
    context.get<T>(type, { strict: false });
  const userId = (key: string) => demoId(`member:${key}`);
  const postId = (key: string) => demoId(`post:${key}`);
  const at = (days: number, minutes = 0) =>
    clock.set(new Date(now.getTime() - days * DAY_MS + minutes * 60_000));
  const result: DevContentResult = {
    discussionComments: 0,
    discussionReactions: 0,
    savedPosts: 0,
    viewDays: 0,
    hiddenPosts: 0,
  };

  const comments = get(CommentsService);
  const discussed = postId('kofi-advice');
  const existing = await comments.list(userId('kofi'), discussed, { limit: 50 });
  if (existing.items.length > 1) return result;

  const created = new Map<string, string>();
  for (const [index, entry] of DISCUSSION.entries()) {
    at(8, index * 20);
    const parentId = entry.replyTo ? created.get(entry.replyTo) : undefined;
    const comment = await comments.create(userId(entry.author), discussed, {
      text: entry.text,
      ...(parentId ? { parentId } : {}),
    });
    created.set(entry.key, comment.id);
    result.discussionComments += 1;
  }
  at(7);
  const reactions = get(ReactionsService);
  for (const reaction of DISCUSSION_REACTIONS) {
    const id = created.get(reaction.comment);
    if (!id) continue;
    await reactions.react(userId(reaction.author), { type: 'comment', id }, reaction.type);
    result.discussionReactions += 1;
  }

  const posts = get(PostsService);
  at(1);
  for (const key of ['kente-launch', 'kofi-advice', 'teranga-report']) {
    await posts.save(userId('aissatou'), postId(key), true);
    result.savedPosts += 1;
  }

  // A week of views, consolidated day by day as the worker does (ADR 0034); its service lives in
  // the worker graph, built here from the providers of the api.
  const maintenance = new ContentMaintenanceService(
    get(ContentRepository),
    new SafeLinkPageFetcher(parseWorkerConfig(process.env), new SafeHttpClient()),
    get(PostViewCounter),
    get(MediaFacade),
    get(ProfilesFacade),
    get(ContentEventsRecorder),
    get(TransactionManager),
    clock,
  );
  const viewers = DEMO_MEMBERS.filter((member) => member.key !== 'aissatou');
  for (const [index, count] of VIEWERS_PER_DAY.entries()) {
    at(VIEWERS_PER_DAY.length - 1 - index);
    for (const viewer of viewers.slice(0, count)) {
      await posts.recordViews(userId(viewer.key), [postId('sahel-harvest')]);
    }
    await maintenance.consolidateViews();
    result.viewDays += 1;
  }

  // A publication hidden by the moderation: its author sees it with a notice.
  at(2);
  const hidden = await posts.create(userId('samuel'), {
    text: 'Offre exceptionnelle : doublez votre investissement en trente jours, écrivez-moi.',
    visibility: 'members',
    commentsDisabled: false,
  });
  await get(ContentFacade).setPostModerationStatus(hidden.id, 'hidden');
  result.hiddenPosts += 1;
  return result;
}
