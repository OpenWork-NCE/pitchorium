import { Injectable } from '@nestjs/common';
import type {
  EmbeddedPost,
  Mention,
  Post,
  PostAuthor,
  ReactionCounts,
  ReactionSummary,
  ReactionType,
} from '@pitchorium/contracts';
import { MediaFacade } from '../../media';
import { NetworkFacade } from '../../network';
import { type OrganizationCard, OrganizationsFacade } from '../../organizations';
import { type MemberCard, ProfilesFacade } from '../../profiles';
import { canView, effectiveVisibility, type PostRecord } from '../domain/post';
import type { ResolvedMention } from '../domain/mentions';
import { ContentRepository } from './ports';

/** The reader of publications, with what decides what they may see. */
export interface Reader {
  viewerId: string | null;
  blocked: ReadonlySet<string>;
  connections: ReadonlySet<string>;
}

export const ANONYMOUS_READER: Reader = {
  viewerId: null,
  blocked: new Set(),
  connections: new Set(),
};

const NO_REACTIONS: ReactionCounts = { like: 0, bravo: 0, insightful: 0, support: 0 };

export function reactionSummary(
  counts: ReactionCounts | undefined,
  viewerReaction: ReactionType | undefined,
): ReactionSummary {
  const all = counts ?? NO_REACTIONS;
  return {
    counts: all,
    total: all.like + all.bravo + all.insightful + all.support,
    viewerReaction: viewerReaction ?? null,
  };
}

export const memberCardView = (card: MemberCard) => ({
  handle: card.handle,
  displayName: card.displayName,
  headline: card.headline,
  avatarUrl: card.avatarUrl,
});

/**
 * Builds the views of publications for a reader, in batch: authors, media (presigned URLs for
 * non-public publications), link preview, mentions, counters and the reader's state. A
 * publication the reader may not see is left out; a repost whose original they may not see
 * keeps `repostOf: null`.
 */
@Injectable()
export class PostPresenter {
  constructor(
    private readonly content: ContentRepository,
    private readonly profiles: ProfilesFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly media: MediaFacade,
    private readonly network: NetworkFacade,
  ) {}

  async reader(viewerId: string): Promise<Reader> {
    const [blocked, connections] = await Promise.all([
      this.network.blockedUserIds(viewerId),
      this.network.connectionIds(viewerId),
    ]);
    return { viewerId, blocked: new Set(blocked), connections: new Set(connections) };
  }

  /** Whether the reader may see the publication, with the current state of its author. */
  async canRead(reader: Reader, post: PostRecord): Promise<boolean> {
    const visible = await this.visibleSubset(reader, [post]);
    return visible.has(post.id);
  }

  async present(reader: Reader, posts: readonly PostRecord[]): Promise<Post[]> {
    if (posts.length === 0) return [];
    const originals = await this.content.findPosts(
      posts.flatMap((post) => (post.kind === 'repost' && post.repostOfId ? [post.repostOfId] : [])),
    );
    const all = [...posts, ...originals];
    const mentions = await this.content.mentionsOf(all.map((post) => post.id));
    const mentioned = [...mentions.values()].flat();
    const [cards, organizationCards] = await Promise.all([
      this.profiles.memberCards(
        [
          ...all.map((post) => post.authorId),
          ...mentioned.filter((m) => m.targetType === 'member').map((m) => m.targetId),
        ],
        reader.viewerId,
      ),
      this.organizations.cards([
        ...all.flatMap((post) => (post.organizationId ? [post.organizationId] : [])),
        ...mentioned.filter((m) => m.targetType === 'organization').map((m) => m.targetId),
      ]),
    ]);
    const visible = this.visibleWith(reader, all, cards, organizationCards);
    const shown = all.filter((post) => visible.has(post.id));
    const ids = shown.map((post) => post.id);
    const viewerId = reader.viewerId;
    const [images, documents, reactions, viewerReactions, comments, reposts, saved] =
      await Promise.all([
        this.media.images(
          shown.flatMap((post) => [
            ...post.imageMediaIds,
            post.documentMediaId,
            post.linkPreview?.imageMediaId ?? null,
          ]),
        ),
        Promise.all(
          shown.flatMap((post) =>
            post.documentMediaId ? [this.media.describe(post.documentMediaId)] : [],
          ),
        ),
        this.content.reactionCounts('post', ids),
        viewerId
          ? this.content.viewerReactions('post', ids, viewerId)
          : new Map<string, ReactionType>(),
        this.content.commentCounts(ids),
        this.content.repostCounts(ids),
        viewerId ? this.content.savedFlags(viewerId, ids) : new Set<string>(),
      ]);
    const pages = new Map(
      documents.flatMap((summary) => (summary ? [[summary.id, summary.pageCount] as const] : [])),
    );

    const embed = (post: PostRecord): EmbeddedPost => {
      const card = cards.get(post.authorId);
      return {
        id: post.id,
        author: this.author(post, card, organizationCards),
        text: post.text,
        language: post.language,
        languageSource: post.languageSource,
        visibility: effectiveVisibility(post, card?.publicPageEnabled ?? false),
        images: post.imageMediaIds.flatMap((mediaId) => {
          const image = images.get(mediaId);
          return image
            ? [
                {
                  mediaId,
                  url: image.url,
                  variants: image.variants,
                  alt: post.imageAlts[mediaId] ?? null,
                },
              ]
            : [];
        }),
        document: post.documentMediaId
          ? {
              mediaId: post.documentMediaId,
              thumbnailUrl: images.get(post.documentMediaId)?.url ?? null,
              pageCount: pages.get(post.documentMediaId) ?? null,
              title: post.documentTitle,
            }
          : null,
        link:
          post.linkUrl && post.linkPreview
            ? {
                url: post.linkUrl,
                status: post.linkPreview.status,
                title: post.linkPreview.title,
                description: post.linkPreview.description,
                siteName: post.linkPreview.siteName,
                imageUrl: post.linkPreview.imageMediaId
                  ? (images.get(post.linkPreview.imageMediaId)?.url ?? null)
                  : null,
              }
            : null,
        mentions: (mentions.get(post.id) ?? []).flatMap((mention): Mention[] => {
          if (mention.targetType === 'member') {
            const member = cards.get(mention.targetId);
            return member
              ? [
                  {
                    token: mention.token,
                    type: 'member',
                    key: member.handle,
                    displayName: member.displayName,
                  },
                ]
              : [];
          }
          const organization = organizationCards.get(mention.targetId);
          return organization
            ? [
                {
                  token: mention.token,
                  type: 'organization',
                  key: organization.slug,
                  displayName: organization.name,
                },
              ]
            : [];
        }),
        projectId: post.projectId,
        commentsDisabled: post.commentsDisabled,
        reactions: reactionSummary(reactions.get(post.id), viewerReactions.get(post.id)),
        commentCount: comments.get(post.id) ?? 0,
        repostCount: reposts.get(post.id) ?? 0,
        saved: saved.has(post.id),
        viewerIsAuthor: viewerId !== null && viewerId === post.authorId,
        featured: post.featuredAt !== null,
        // Only its author still reads a hidden publication (canView): the state is for them.
        moderation: post.moderationStatus === 'hidden' ? 'hidden' : 'visible',
        createdAt: post.createdAt.toISOString(),
        editedAt: post.editedAt?.toISOString() ?? null,
      };
    };

    const byId = new Map(shown.map((post) => [post.id, post]));
    return posts.flatMap((post): Post[] => {
      if (!visible.has(post.id)) return [];
      const original = post.repostOfId ? byId.get(post.repostOfId) : undefined;
      return [{ ...embed(post), kind: post.kind, repostOf: original ? embed(original) : null }];
    });
  }

  /**
   * Mentions as the reader sees them: the current handle and name of a member, the slug and name
   * of an organization; a member hidden from the reader (blocks) is left out, its token stays
   * plain text.
   */
  async mentionViews(
    reader: Reader,
    mentions: ReadonlyMap<string, readonly ResolvedMention[]>,
  ): Promise<Map<string, Mention[]>> {
    const all = [...mentions.values()].flat();
    const [cards, organizationCards] = await Promise.all([
      this.profiles.memberCards(
        all.filter((m) => m.targetType === 'member').map((m) => m.targetId),
        reader.viewerId,
      ),
      this.organizations.cards(
        all.filter((m) => m.targetType === 'organization').map((m) => m.targetId),
      ),
    ]);
    return new Map(
      [...mentions].map(([id, list]) => [
        id,
        list.flatMap((mention): Mention[] => {
          if (mention.targetType === 'member') {
            const member = cards.get(mention.targetId);
            return member
              ? [
                  {
                    token: mention.token,
                    type: 'member',
                    key: member.handle,
                    displayName: member.displayName,
                  },
                ]
              : [];
          }
          const organization = organizationCards.get(mention.targetId);
          return organization
            ? [
                {
                  token: mention.token,
                  type: 'organization',
                  key: organization.slug,
                  displayName: organization.name,
                },
              ]
            : [];
        }),
      ]),
    );
  }

  /** Identifiers of the publications the reader may see among these. */
  async visibleSubset(reader: Reader, posts: readonly PostRecord[]): Promise<Set<string>> {
    const [cards, organizationCards] = await Promise.all([
      this.profiles.memberCards(
        posts.map((post) => post.authorId),
        reader.viewerId,
      ),
      this.organizations.cards(
        posts.flatMap((post) => (post.organizationId ? [post.organizationId] : [])),
      ),
    ]);
    return this.visibleWith(reader, posts, cards, organizationCards);
  }

  private visibleWith(
    reader: Reader,
    posts: readonly PostRecord[],
    cards: ReadonlyMap<string, MemberCard>,
    organizationCards: ReadonlyMap<string, OrganizationCard>,
  ): Set<string> {
    const visible = new Set<string>();
    for (const post of posts) {
      const card = cards.get(post.authorId);
      if (!card) continue;
      if (post.organizationId && !organizationCards.has(post.organizationId)) continue;
      const visibility = effectiveVisibility(post, card.publicPageEnabled);
      const readable = canView(post, visibility, {
        viewerId: reader.viewerId,
        connectedToAuthor: reader.connections.has(post.authorId),
        blockedWithAuthor: reader.blocked.has(post.authorId),
      });
      if (readable) visible.add(post.id);
    }
    return visible;
  }

  private author(
    post: PostRecord,
    card: MemberCard | undefined,
    organizationCards: ReadonlyMap<string, OrganizationCard>,
  ): PostAuthor {
    const organization = post.organizationId
      ? organizationCards.get(post.organizationId)
      : undefined;
    if (organization) {
      return {
        type: 'organization',
        organization: {
          id: organization.id,
          slug: organization.slug,
          name: organization.name,
          logoUrl: organization.logoUrl,
          verified: organization.verified,
        },
      };
    }
    return {
      type: 'member',
      member: card
        ? memberCardView(card)
        : { handle: 'deleted', displayName: '', headline: null, avatarUrl: null },
    };
  }
}
