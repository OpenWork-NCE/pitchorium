import { Injectable } from '@nestjs/common';
import type {
  CreatePostRequest,
  CreateRepostRequest,
  CursorPage,
  CursorPageQuery,
  Post,
  PostStats,
  PostVisibility,
  SavedPost,
  UpdatePostRequest,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  DomainError,
  decodeKeyset,
  encodeKeyset,
  IdGenerator,
} from '../../../platform/kernel';
import { MediaFacade, type MediaResourceRef } from '../../media';
import { NetworkFacade } from '../../network';
import { OrganizationsFacade } from '../../organizations';
import { ProfilesFacade } from '../../profiles';
import {
  MentionCreated,
  PostCreated,
  PostDeleted,
  PostReposted,
  PostUpdated,
} from '../domain/content-events';
import { resolveLanguage } from '../domain/language';
import { extractMentionKeys, type ResolvedMention, resolveMentions } from '../domain/mentions';
import {
  assertPublishable,
  assertRepostAllowed,
  assertVisibilityAllowed,
  effectiveVisibility,
  type LinkPreviewDraftRecord,
  type PostAuthorContext,
  type PostRecord,
  repostTarget,
} from '../domain/post';
import { dayOf } from '../domain/views';
import { ContentEventsRecorder } from './content-events.recorder';
import { ContentRepository, LanguageDetector, PostViewCounter } from './ports';
import { PostPresenter, type Reader } from './post-presenter';
import { ProjectLinkRegistry } from './project-link.registry';

export const POST_RESOURCE = 'post';
export const postResource = (postId: string): MediaResourceRef => ({
  type: POST_RESOURCE,
  id: postId,
});

const notFound = () => new DomainError('CONTENT_POST_NOT_FOUND', 'Publication not found');
const mediaNotInPost = () =>
  new DomainError('CONTENT_MEDIA_NOT_IN_POST', 'This media is not part of the publication');

/** Changes that do not mark a publication « modifiée »: the comments, the text alternatives. */
const UNMARKED_FIELDS = new Set(['commentsDisabled', 'imageAlts']);

/** The text alternatives of a publication after a change; an empty one removes it. */
function withImageAlts(
  post: PostRecord,
  changes: readonly { mediaId: string; alt: string | null }[],
): Record<string, string> {
  const alts = { ...post.imageAlts };
  for (const { mediaId, alt } of changes) {
    if (!post.imageMediaIds.includes(mediaId)) throw mediaNotInPost();
    if (alt) alts[mediaId] = alt;
    else delete alts[mediaId];
  }
  // Same order as the images, so that two equal maps compare equal.
  return Object.fromEntries(
    post.imageMediaIds.flatMap((mediaId) => (alts[mediaId] ? [[mediaId, alts[mediaId]]] : [])),
  );
}

/** Publications and reposts (§10.3, ADR 0031). */
@Injectable()
export class PostsService {
  constructor(
    private readonly content: ContentRepository,
    private readonly presenter: PostPresenter,
    private readonly profiles: ProfilesFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly network: NetworkFacade,
    private readonly media: MediaFacade,
    private readonly projects: ProjectLinkRegistry,
    private readonly language: LanguageDetector,
    private readonly views: PostViewCounter,
    private readonly events: ContentEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async create(userId: string, body: CreatePostRequest): Promise<Post> {
    const text = body.text ? body.text : null;
    const images = body.images ?? [];
    const imageMediaIds = images.map((image) => image.mediaId);
    assertPublishable({
      text,
      imageCount: imageMediaIds.length,
      hasDocument: body.documentMediaId !== undefined,
      hasLink: body.linkUrl !== undefined,
    });
    const author = await this.authorContext(userId, body.organizationId ?? null);
    assertVisibilityAllowed(body.visibility, author);
    if (body.projectId) await this.projects.assertAttachable(body.projectId, userId);
    const mentions = await this.mentions(userId, text);
    const now = this.clock.now();
    const draft = await this.reusablePreview(userId, body.linkUrl, body.linkPreviewId);
    const post: PostRecord = {
      id: this.ids.next(),
      authorId: userId,
      organizationId: body.organizationId ?? null,
      kind: 'post',
      text,
      ...resolveLanguage(body.language, text ? this.language.detect(text) : null),
      visibility: body.visibility,
      repostOfId: null,
      projectId: body.projectId ?? null,
      imageMediaIds,
      imageAlts: Object.fromEntries(
        images.flatMap((image) => (image.alt ? [[image.mediaId, image.alt]] : [])),
      ),
      documentMediaId: body.documentMediaId ?? null,
      documentTitle: body.documentMediaId ? (body.documentTitle ?? null) : null,
      linkUrl: body.linkUrl ?? null,
      linkPreview: body.linkUrl
        ? draft
          ? {
              status: draft.status,
              title: draft.title,
              description: draft.description,
              siteName: draft.siteName,
              imageMediaId: draft.imageMediaId,
            }
          : {
              status: 'pending',
              title: null,
              description: null,
              siteName: null,
              imageMediaId: null,
            }
        : null,
      commentsDisabled: body.commentsDisabled,
      moderationStatus: 'visible',
      featuredAt: null,
      featuredBy: null,
      createdAt: now,
      editedAt: null,
      deletedAt: null,
    };
    const resourceVisibility = body.visibility === 'public' ? 'public' : 'private';
    await this.transactions.run(async () => {
      await this.content.insertPost(post);
      await this.content.replaceMentions(post.id, mentions);
      for (const mediaId of imageMediaIds) {
        await this.media.attach({
          mediaId,
          ownerId: userId,
          usage: 'post_image',
          resource: postResource(post.id),
          resourceVisibility,
        });
      }
      if (post.documentMediaId) {
        await this.media.attach({
          mediaId: post.documentMediaId,
          ownerId: userId,
          usage: 'post_document',
          resource: postResource(post.id),
        });
      }
      if (draft) {
        await this.content.deleteLinkPreview(draft.id);
        // A ready image is attached now; a pending one when it is ready (link-preview-image).
        if (
          draft.imageMediaId &&
          (await this.media.describe(draft.imageMediaId))?.status === 'ready'
        ) {
          await this.media.attach({
            mediaId: draft.imageMediaId,
            ownerId: userId,
            usage: 'link_preview',
            resource: postResource(post.id),
            resourceVisibility,
          });
        }
      }
      await this.events.record(PostCreated, post.id, {
        authorId: userId,
        organizationId: post.organizationId,
        visibility: post.visibility,
        hasLink: post.linkUrl !== null,
      });
      await this.recordMentions(post.id, userId, mentions);
    });
    return this.presentOne(await this.presenter.reader(userId), post);
  }

  /**
   * The preview the composer asked for the same link (ADR 0118), when it is built: reused by
   * the publication. Anything else (another member's, another link, still pending) is ignored
   * and the publication builds its own.
   */
  private async reusablePreview(
    userId: string,
    linkUrl: string | undefined,
    previewId: string | undefined,
  ): Promise<LinkPreviewDraftRecord | null> {
    if (!linkUrl || !previewId) return null;
    const draft = await this.content.findLinkPreview(previewId);
    return draft && draft.ownerId === userId && draft.url === linkUrl && draft.status !== 'pending'
      ? draft
      : null;
  }

  /** Text, visibility, language and comments; any change but comments marks it edited. */
  async update(userId: string, postId: string, body: UpdatePostRequest): Promise<Post> {
    const post = await this.owned(userId, postId);
    const fields: string[] = [];
    const now = this.clock.now();
    const patch: Partial<PostRecord> = {};
    let mentions: ResolvedMention[] | null = null;
    if (body.text !== undefined && (body.text || null) !== post.text) {
      patch.text = body.text || null;
      assertPublishable({
        text: patch.text,
        imageCount: post.imageMediaIds.length,
        hasDocument: post.documentMediaId !== null,
        hasLink: post.linkUrl !== null || post.kind === 'repost',
      });
      mentions = await this.mentions(userId, patch.text);
      fields.push('text');
    }
    if (body.visibility !== undefined && body.visibility !== post.visibility) {
      assertVisibilityAllowed(
        body.visibility,
        await this.authorContext(userId, post.organizationId),
      );
      if (post.kind === 'repost' && post.repostOfId)
        await this.assertRepostable(userId, post.repostOfId, body.visibility);
      patch.visibility = body.visibility;
      fields.push('visibility');
    }
    if (body.language !== undefined || patch.text !== undefined) {
      const text = patch.text !== undefined ? patch.text : post.text;
      const declared =
        body.language !== undefined
          ? body.language
          : post.languageSource === 'declared'
            ? post.language
            : null;
      const language = resolveLanguage(declared, text ? this.language.detect(text) : null);
      if (language.language !== post.language || language.languageSource !== post.languageSource) {
        Object.assign(patch, language);
        fields.push('language');
      }
    }
    if (body.commentsDisabled !== undefined && body.commentsDisabled !== post.commentsDisabled) {
      patch.commentsDisabled = body.commentsDisabled;
      fields.push('commentsDisabled');
    }
    if (body.imageAlts !== undefined) {
      const alts = withImageAlts(post, body.imageAlts);
      if (JSON.stringify(alts) !== JSON.stringify(post.imageAlts)) {
        patch.imageAlts = alts;
        fields.push('imageAlts');
      }
    }
    if (body.documentTitle !== undefined && body.documentTitle !== post.documentTitle) {
      if (post.documentMediaId === null) throw mediaNotInPost();
      patch.documentTitle = body.documentTitle;
      fields.push('documentTitle');
    }
    if (fields.length > 0) {
      // Accessibility and presentation (comments, text alternatives) do not mark it edited.
      if (fields.some((field) => !UNMARKED_FIELDS.has(field))) patch.editedAt = now;
      await this.transactions.run(async () => {
        await this.content.updatePost(post.id, patch);
        if (mentions) {
          const previous = new Set(
            ((await this.content.mentionsOf([post.id])).get(post.id) ?? []).map(
              (mention) => `${mention.targetType}:${mention.targetId}`,
            ),
          );
          await this.content.replaceMentions(post.id, mentions);
          await this.recordMentions(
            post.id,
            userId,
            mentions.filter(
              (mention) => !previous.has(`${mention.targetType}:${mention.targetId}`),
            ),
          );
        }
        if (patch.visibility) {
          await this.media.setResourceVisibility(
            postResource(post.id),
            patch.visibility === 'public' ? 'public' : 'private',
          );
        }
        await this.events.record(PostUpdated, post.id, { authorId: userId, fields });
      });
    }
    return this.presentOne(await this.presenter.reader(userId), { ...post, ...patch });
  }

  async delete(userId: string, postId: string): Promise<void> {
    const post = await this.owned(userId, postId);
    await this.transactions.run(async () => {
      await this.content.updatePost(post.id, { deletedAt: this.clock.now() });
      for (const mediaId of [
        ...post.imageMediaIds,
        post.documentMediaId,
        post.linkPreview?.imageMediaId ?? null,
      ]) {
        if (mediaId) await this.media.detach(mediaId);
      }
      await this.events.record(PostDeleted, post.id, { authorId: userId });
    });
  }

  /** Reposts the original of a publication, with an optional comment. */
  async repost(userId: string, postId: string, body: CreateRepostRequest): Promise<Post> {
    const reader = await this.presenter.reader(userId);
    const source = await this.readable(reader, postId);
    const originalId = repostTarget(source);
    await this.assertRepostable(userId, originalId, body.visibility);
    assertVisibilityAllowed(body.visibility, await this.authorContext(userId, null));
    const text = body.comment ? body.comment : null;
    const mentions = await this.mentions(userId, text);
    const original = await this.content.findPost(originalId);
    if (!original) throw notFound();
    const post: PostRecord = {
      id: this.ids.next(),
      authorId: userId,
      organizationId: null,
      kind: 'repost',
      text,
      ...resolveLanguage(null, text ? this.language.detect(text) : null),
      visibility: body.visibility,
      repostOfId: originalId,
      projectId: null,
      imageMediaIds: [],
      imageAlts: {},
      documentMediaId: null,
      documentTitle: null,
      linkUrl: null,
      linkPreview: null,
      commentsDisabled: false,
      moderationStatus: 'visible',
      featuredAt: null,
      featuredBy: null,
      createdAt: this.clock.now(),
      editedAt: null,
      deletedAt: null,
    };
    await this.transactions.run(async () => {
      await this.content.insertPost(post);
      await this.content.replaceMentions(post.id, mentions);
      await this.events.record(PostReposted, post.id, {
        authorId: userId,
        repostOfId: originalId,
        originalAuthorId: original.authorId,
      });
      await this.recordMentions(post.id, userId, mentions);
    });
    return this.presentOne(reader, post);
  }

  async get(userId: string, postId: string): Promise<Post> {
    const reader = await this.presenter.reader(userId);
    const post = await this.readable(reader, postId);
    const view = await this.presentOne(reader, post);
    if (post.authorId !== userId) this.views.record(userId, [post.id], dayOf(this.clock.now()));
    return view;
  }

  /** Page of a public publication, for readers without an account. */
  async getPublic(postId: string): Promise<Post> {
    const post = await this.content.findPost(postId);
    if (!post) throw notFound();
    const [view] = await this.presenter.present(
      { viewerId: null, blocked: new Set(), connections: new Set() },
      [post],
    );
    if (!view || view.visibility !== 'public') throw notFound();
    return view;
  }

  async save(userId: string, postId: string, saved: boolean): Promise<void> {
    if (!saved) {
      await this.content.unsavePost(userId, postId);
      return;
    }
    await this.readable(await this.presenter.reader(userId), postId);
    await this.content.savePost(userId, postId, this.clock.now());
  }

  async hide(userId: string, postId: string, hidden: boolean): Promise<void> {
    if (!hidden) {
      await this.content.unhidePost(userId, postId);
      return;
    }
    if (!(await this.content.findPost(postId))) throw notFound();
    await this.content.hidePost(userId, postId, this.clock.now());
  }

  async savedPosts(userId: string, query: CursorPageQuery): Promise<CursorPage<SavedPost>> {
    const rows = await this.content.savedPosts(userId, decodeKeyset(query.cursor), query.limit + 1);
    const page = rows.slice(0, query.limit);
    const reader = await this.presenter.reader(userId);
    const views = new Map(
      (
        await this.presenter.present(
          reader,
          await this.content.findPosts(page.map((row) => row.postId)),
        )
      ).map((view) => [view.id, view]),
    );
    const last = page.at(-1);
    return {
      items: page.flatMap((row) => {
        const post = views.get(row.postId);
        return post ? [{ savedAt: row.savedAt.toISOString(), post }] : [];
      }),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.savedAt, key: last.postId })
          : null,
    };
  }

  /**
   * Publications the member saw on screen (ADR 0116), counted once per member and per day by
   * the HyperLogLog (a signal sent twice counts once): those they may read, never their own.
   */
  async recordViews(userId: string, postIds: readonly string[]): Promise<void> {
    const posts = (await this.content.findPosts([...new Set(postIds)])).filter(
      (post) => post.authorId !== userId,
    );
    if (posts.length === 0) return;
    const visible = await this.presenter.visibleSubset(await this.presenter.reader(userId), posts);
    this.views.record(
      userId,
      posts.flatMap((post) => (visible.has(post.id) ? [post.id] : [])),
      dayOf(this.clock.now()),
    );
  }

  /** Daily unique viewers, for the author only (resolver ownership). */
  async stats(postId: string): Promise<PostStats> {
    return { postId, days: await this.content.dailyViews(postId) };
  }

  /**
   * Publications and reposts of a member, newest first (« Activité » of their page), as the
   * reader may see them: visibility, blocks and moderation applied by the presenter. Without a
   * reader, the public ones of a member who keeps a public page. Unknown or hidden: 404.
   */
  async memberPosts(
    viewerId: string | null,
    handle: string,
    query: CursorPageQuery,
  ): Promise<CursorPage<Post>> {
    const userId = (await this.profiles.userIdsByHandles([handle], viewerId)).get(handle);
    if (!userId) throw new DomainError('PROFILES_PROFILE_NOT_FOUND', 'Profile not found');
    if (viewerId === null && !(await this.profiles.visibilityOf(userId))?.publicPageEnabled) {
      throw new DomainError('PROFILES_PROFILE_NOT_FOUND', 'Profile not found');
    }
    return this.authoredPage(viewerId, { memberId: userId }, query);
  }

  /** Publications of an organization, newest first, as the reader may see them. */
  async organizationPosts(
    viewerId: string | null,
    slug: string,
    query: CursorPageQuery,
  ): Promise<CursorPage<Post>> {
    const organizationId = (await this.organizations.idsBySlugs([slug])).get(slug);
    if (!organizationId) throw new DomainError('ORGANIZATIONS_NOT_FOUND', 'Organization not found');
    return this.authoredPage(viewerId, { organizationId }, query);
  }

  private async authoredPage(
    viewerId: string | null,
    author: { memberId: string } | { organizationId: string },
    query: CursorPageQuery,
  ): Promise<CursorPage<Post>> {
    const rows = await this.content.authoredPosts(
      author,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const reader = viewerId
      ? await this.presenter.reader(viewerId)
      : { viewerId: null, blocked: new Set<string>(), connections: new Set<string>() };
    const views = await this.presenter.present(
      reader,
      await this.content.findPosts(page.map((row) => row.id)),
    );
    const byId = new Map(
      views
        // Without a reader, only what anyone may read.
        .filter((post) => viewerId !== null || post.visibility === 'public')
        .map((post) => [post.id, post]),
    );
    const last = page.at(-1);
    return {
      items: page.flatMap((row) => byId.get(row.id) ?? []),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.id })
          : null,
    };
  }

  /** A live publication the reader may see; 404 otherwise (blocks included). */
  async readable(reader: Reader, postId: string): Promise<PostRecord> {
    const post = await this.content.findPost(postId);
    if (!post || !(await this.presenter.canRead(reader, post))) throw notFound();
    return post;
  }

  private async owned(userId: string, postId: string): Promise<PostRecord> {
    const post = await this.content.findPost(postId);
    if (!post || post.deletedAt || post.authorId !== userId) throw notFound();
    return post;
  }

  private async presentOne(reader: Reader, post: PostRecord): Promise<Post> {
    const [view] = await this.presenter.present(reader, [post]);
    if (!view) throw notFound();
    return view;
  }

  private async assertRepostable(
    userId: string,
    originalId: string,
    visibility: PostVisibility,
  ): Promise<void> {
    const original = await this.readable(await this.presenter.reader(userId), originalId);
    const card = (await this.profiles.memberCards([original.authorId])).get(original.authorId);
    assertRepostAllowed(
      original,
      effectiveVisibility(original, card?.publicPageEnabled ?? false),
      userId,
      visibility,
    );
  }

  private async authorContext(
    userId: string,
    organizationId: string | null,
  ): Promise<PostAuthorContext> {
    if (organizationId) {
      const role = await this.organizations.roleOf(organizationId, userId);
      if (role !== 'owner' && role !== 'admin') {
        throw new DomainError(
          'CONTENT_ORGANIZATION_ROLE_REQUIRED',
          'Only owners and admins publish as the organization',
        );
      }
      return { kind: 'organization' };
    }
    const visibility = await this.profiles.visibilityOf(userId);
    return { kind: 'member', publicPageEnabled: visibility?.publicPageEnabled ?? false };
  }

  /**
   * Mentions resolved to stable identifiers. A member on either side of a block is unknown to
   * the author, like a handle nobody holds (ADR 0029): the token stays plain text.
   */
  private async mentions(userId: string, text: string | null): Promise<ResolvedMention[]> {
    const keys = extractMentionKeys(text);
    if (keys.length === 0) return [];
    const members = await this.profiles.userIdsByHandles(keys, userId);
    const unresolved = keys.filter((key) => !members.has(key));
    const organizations = await this.organizations.idsBySlugs(unresolved);
    const resolved = resolveMentions(keys, members, organizations);
    const blocked = new Set(await this.network.blockedUserIds(userId));
    if (
      resolved.some((mention) => mention.targetType === 'member' && blocked.has(mention.targetId))
    ) {
      throw new DomainError('CONTENT_MENTION_NOT_ALLOWED', 'A mentioned member is blocked');
    }
    return resolved;
  }

  private async recordMentions(
    postId: string,
    authorId: string,
    mentions: readonly ResolvedMention[],
  ): Promise<void> {
    for (const mention of mentions) {
      if (mention.targetType === 'member' && mention.targetId === authorId) continue;
      await this.events.record(MentionCreated, postId, {
        authorId,
        targetType: mention.targetType,
        targetId: mention.targetId,
      });
    }
  }
}
