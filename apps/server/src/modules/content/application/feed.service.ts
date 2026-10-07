import { Inject, Injectable } from '@nestjs/common';
import {
  type CursorPageQuery,
  FEED_SCHEMA_VERSION,
  type FeedItem,
  type FeedPage,
} from '@pitchorium/contracts';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import {
  Clock,
  decodeCursor,
  encodeKeyset,
  type KeysetPosition,
  keysetFrom,
} from '../../../platform/kernel';
import { NetworkFacade } from '../../network';
import { ORGANIZATION_FOLLOW_TARGET } from '../../organizations';
import { dayOf } from '../domain/views';
import { ContentRepository, type NetworkFeedQuery, PostViewCounter } from './ports';
import { PostPresenter } from './post-presenter';

type Phase = 'network' | 'featured';

/**
 * Feed of a member (§10.3, ADR 0032): fan-out on read of the publications and reposts of the
 * followed members and organizations and of the member, newest first. When the network
 * produces fewer items than CONTENT_FEED_EDITORIAL_THRESHOLD, the feed goes on with editorial
 * highlights; there is no anonymous global feed.
 */
@Injectable()
export class FeedService {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly content: ContentRepository,
    private readonly presenter: PostPresenter,
    private readonly network: NetworkFacade,
    private readonly views: PostViewCounter,
    private readonly clock: Clock,
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
    const phase: Phase = cursor?.['phase'] === 'featured' ? 'featured' : 'network';
    const after: KeysetPosition | null = cursor && cursor['at'] ? keysetFrom(cursor) : null;
    const threshold = this.config.content.feedEditorialThreshold;
    const small =
      cursor !== null
        ? cursor['small'] === '1'
        : (await this.content.countNetworkFeed(query, threshold)) < threshold;

    const entries: { id: string; type: FeedItem['type'] | 'featured' }[] = [];
    let nextCursor: string | null = null;
    let featuredAfter: KeysetPosition | null = phase === 'featured' ? after : null;
    if (phase === 'network') {
      const rows = await this.content.networkFeed(query, after, page.limit + 1);
      const shown = rows.slice(0, page.limit);
      entries.push(...shown.map((row) => ({ id: row.id, type: 'post' as const })));
      const last = shown.at(-1);
      if (rows.length > page.limit && last) {
        nextCursor = encodeKeyset(
          { at: last.createdAt, key: last.id },
          { phase: 'network', small: small ? '1' : '0' },
        );
      }
      featuredAfter = null;
    }
    const remaining = page.limit - entries.length;
    if (nextCursor === null && small && remaining > 0) {
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
    }

    const reader = await this.presenter.reader(viewerId);
    const records = await this.content.findPosts(entries.map((entry) => entry.id));
    const ordered = entries.flatMap((entry) => {
      const record = records.find((post) => post.id === entry.id);
      return record ? [record] : [];
    });
    const posts = new Map(
      (await this.presenter.present(reader, ordered)).map((post) => [post.id, post]),
    );
    const items = entries.flatMap((entry): FeedItem[] => {
      const post = posts.get(entry.id);
      if (!post) return [];
      if (entry.type === 'featured') return [{ type: 'featured', id: `featured:${post.id}`, post }];
      return post.kind === 'repost'
        ? [{ type: 'repost', id: `repost:${post.id}`, post }]
        : [{ type: 'post', id: `post:${post.id}`, post }];
    });
    this.views.record(
      viewerId,
      items.filter((item) => !item.post.viewerIsAuthor).map((item) => item.post.id),
      dayOf(this.clock.now()),
    );
    return { schemaVersion: FEED_SCHEMA_VERSION, items, nextCursor };
  }
}
