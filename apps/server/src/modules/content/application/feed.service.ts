import { Inject, Injectable } from '@nestjs/common';
import {
  type CursorPageQuery,
  FEED_SCHEMA_VERSION,
  type FeedItem,
  type FeedPage,
  type FeedSuggestion,
} from '@pitchorium/contracts';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import {
  decodeCursor,
  encodeCursor,
  encodeKeyset,
  type KeysetPosition,
  keysetFrom,
} from '../../../platform/kernel';
import { NetworkFacade } from '../../network';
import { ORGANIZATION_FOLLOW_TARGET } from '../../organizations';
import { ContentRepository, type FeedEntry, type NetworkFeedQuery } from './ports';
import { PostPresenter } from './post-presenter';
import { FeedSourcesRegistry } from './feed-sources.registry';
import { ProjectLinkRegistry } from './project-link.registry';

type Phase = 'network' | 'featured' | 'suggestion';
type Entry = { id: string; type: 'post' | 'featured' | 'project_update' | 'event' };

/** Suggestions at most at the end of a small feed (provisional, docs/open-questions.md). */
export const FEED_SUGGESTIONS_MAX = 10;

/** Newest first, the id breaking ties, as the SQL keyset order. */
const newestFirst = (a: FeedEntry, b: FeedEntry) =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * Feed of a member (§10.3, ADR 0032): fan-out on read of the publications and reposts of the
 * followed members and organizations and of the member, merged with the updates of the
 * followed projects (projects module) and the events of the followed organizers (events
 * module), newest first. When the network produces fewer items than
 * CONTENT_FEED_EDITORIAL_THRESHOLD, the feed goes on with editorial highlights, then with
 * explained suggestions (discovery module); there is no anonymous global feed.
 */
@Injectable()
export class FeedService {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly content: ContentRepository,
    private readonly presenter: PostPresenter,
    private readonly network: NetworkFacade,
    private readonly projects: ProjectLinkRegistry,
    private readonly sources: FeedSourcesRegistry,
  ) {}

  async feed(viewerId: string, page: CursorPageQuery): Promise<FeedPage> {
    const [followed, organizations, connections, blocked] = await Promise.all([
      this.network.followedMemberIds(viewerId),
      this.network.followedIds(viewerId, ORGANIZATION_FOLLOW_TARGET),
      this.network.connectionIds(viewerId),
      this.network.blockedUserIds(viewerId),
    ]);
    const blockedSet = new Set(blocked);
    const query: NetworkFeedQuery = {
      viewerId,
      memberAuthorIds: [...new Set([viewerId, ...followed])].filter((id) => !blockedSet.has(id)),
      organizationIds: organizations,
      connectionAuthorIds: [viewerId, ...connections],
      blockedUserIds: blocked,
    };
    const cursor = page.cursor ? decodeCursor(page.cursor) : null;
    const phase: Phase =
      cursor?.['phase'] === 'featured' || cursor?.['phase'] === 'suggestion'
        ? cursor['phase']
        : 'network';
    const after: KeysetPosition | null = cursor && cursor['at'] ? keysetFrom(cursor) : null;
    const threshold = this.config.content.feedEditorialThreshold;
    const small =
      cursor !== null
        ? cursor['small'] === '1'
        : (await this.content.countNetworkFeed(query, threshold)) +
            (await this.projects.updateEntries(viewerId, null, threshold)).length +
            (await this.sources.eventEntries(viewerId, null, threshold)).length <
          threshold;

    const entries: Entry[] = [];
    let nextCursor: string | null = null;
    let featuredAfter: KeysetPosition | null = phase === 'featured' ? after : null;
    if (phase === 'network') {
      const [posts, updates, events] = await Promise.all([
        this.content.networkFeed(query, after, page.limit + 1),
        this.projects.updateEntries(viewerId, after, page.limit + 1),
        this.sources.eventEntries(viewerId, after, page.limit + 1),
      ]);
      const updateIds = new Set(updates.map((update) => update.id));
      const eventIds = new Set(events.map((event) => event.id));
      const rows = [...posts, ...updates, ...events].sort(newestFirst);
      const shown = rows.slice(0, page.limit);
      entries.push(
        ...shown.map((row): Entry => ({
          id: row.id,
          type: updateIds.has(row.id) ? 'project_update' : eventIds.has(row.id) ? 'event' : 'post',
        })),
      );
      const last = shown.at(-1);
      if (rows.length > page.limit && last) {
        nextCursor = encodeKeyset(
          { at: last.createdAt, key: last.id },
          { phase: 'network', small: small ? '1' : '0' },
        );
      }
      featuredAfter = null;
    }
    let remaining = page.limit - entries.length;
    if (phase !== 'suggestion' && nextCursor === null && small && remaining > 0) {
      const rows = await this.content.featuredFeed(query, featuredAfter, remaining + 1);
      const shown = rows.slice(0, remaining);
      entries.push(...shown.map((row) => ({ id: row.id, type: 'featured' as const })));
      const last = shown.at(-1);
      if (rows.length > remaining && last) {
        nextCursor = encodeKeyset(
          { at: last.featuredAt, key: last.id },
          { phase: 'featured', small: '1' },
        );
      }
      remaining = page.limit - entries.length;
    }
    // Suggestions close a small feed; their cursor is an offset in the ranked suggestions.
    const suggestions: { id: string; suggestion: FeedSuggestion }[] = [];
    if (nextCursor === null && small && remaining > 0) {
      const offset = phase === 'suggestion' ? Math.max(0, Number(cursor?.['offset']) || 0) : 0;
      const wanted = Math.min(remaining, FEED_SUGGESTIONS_MAX - offset);
      if (wanted > 0) {
        const rows = await this.sources.suggestions(viewerId, offset, wanted + 1);
        suggestions.push(...rows.slice(0, wanted));
        if (rows.length > wanted && offset + wanted < FEED_SUGGESTIONS_MAX) {
          nextCursor = encodeCursor({
            phase: 'suggestion',
            small: '1',
            offset: String(offset + wanted),
          });
        }
      }
    }

    const reader = await this.presenter.reader(viewerId);
    const postIds = entries.flatMap((entry) =>
      entry.type === 'project_update' || entry.type === 'event' ? [] : [entry.id],
    );
    const records = await this.content.findPosts(postIds);
    const ordered = postIds.flatMap((id) => {
      const record = records.find((post) => post.id === id);
      return record ? [record] : [];
    });
    const [posts, updates, events] = await Promise.all([
      this.presenter
        .present(reader, ordered)
        .then((views) => new Map(views.map((post) => [post.id, post]))),
      this.projects.presentUpdates(
        viewerId,
        entries.flatMap((entry) => (entry.type === 'project_update' ? [entry.id] : [])),
      ),
      this.sources.presentEvents(
        viewerId,
        entries.flatMap((entry) => (entry.type === 'event' ? [entry.id] : [])),
      ),
    ]);
    const items = entries.flatMap((entry): FeedItem[] => {
      if (entry.type === 'project_update') {
        const update = updates.get(entry.id);
        return update
          ? [{ type: 'project_update', id: `project_update:${update.id}`, update }]
          : [];
      }
      if (entry.type === 'event') {
        const event = events.get(entry.id);
        return event ? [{ type: 'event', id: `event:${event.id}`, event }] : [];
      }
      const post = posts.get(entry.id);
      if (!post) return [];
      if (entry.type === 'featured') return [{ type: 'featured', id: `featured:${post.id}`, post }];
      return post.kind === 'repost'
        ? [{ type: 'repost', id: `repost:${post.id}`, post }]
        : [{ type: 'post', id: `post:${post.id}`, post }];
    });
    items.push(
      ...suggestions.map((row): FeedItem => ({
        type: 'suggestion',
        id: `suggestion:${row.id}`,
        suggestion: row.suggestion,
      })),
    );
    // A loaded page is not a seen one: the browser signals what was on screen (ADR 0116).
    return { schemaVersion: FEED_SCHEMA_VERSION, items, nextCursor };
  }
}
