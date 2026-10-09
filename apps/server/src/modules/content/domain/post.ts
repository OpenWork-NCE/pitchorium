import type {
  ContentModerationStatus,
  LanguageSource,
  PostVisibility,
} from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export interface LinkPreviewState {
  status: 'pending' | 'ready' | 'failed';
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageMediaId: string | null;
}

export interface PostRecord {
  id: string;
  authorId: string;
  organizationId: string | null;
  kind: 'post' | 'repost';
  text: string | null;
  language: string | null;
  languageSource: LanguageSource;
  visibility: PostVisibility;
  repostOfId: string | null;
  projectId: string | null;
  imageMediaIds: string[];
  /** Text alternatives of the images, by media id; an image without one is absent. */
  imageAlts: Record<string, string>;
  documentMediaId: string | null;
  documentTitle: string | null;
  linkUrl: string | null;
  linkPreview: LinkPreviewState | null;
  commentsDisabled: boolean;
  moderationStatus: ContentModerationStatus;
  featuredAt: Date | null;
  featuredBy: string | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

/** Preview of a link asked before publishing (ADR 0118), reused by the publication. */
export interface LinkPreviewDraftRecord extends LinkPreviewState {
  id: string;
  ownerId: string;
  url: string;
  createdAt: Date;
}

/** Who publishes: a member, or a member on behalf of an organization (public page by default). */
export type PostAuthorContext =
  { kind: 'member'; publicPageEnabled: boolean } | { kind: 'organization' };

/** What a publication holds: a text, up to nine images or one document, a link. */
export function assertPublishable(draft: {
  text: string | null;
  imageCount: number;
  hasDocument: boolean;
  hasLink: boolean;
}): void {
  if (draft.imageCount > 0 && draft.hasDocument) {
    throw new DomainError('CONTENT_MEDIA_COMBINATION', 'Images and a document are exclusive');
  }
  if (!draft.text && draft.imageCount === 0 && !draft.hasDocument && !draft.hasLink) {
    throw new DomainError('CONTENT_POST_EMPTY', 'A publication needs some content');
  }
}

/**
 * `public` needs the public page of a member author (ADR 0031); an organization has no
 * connections, so its publications are `public` or `members`.
 */
export function assertVisibilityAllowed(
  visibility: PostVisibility,
  author: PostAuthorContext,
): void {
  if (author.kind === 'organization' && visibility === 'connections') {
    throw new DomainError('CONTENT_VISIBILITY_NOT_ALLOWED', 'Organizations have no connections');
  }
  if (author.kind === 'member' && visibility === 'public' && !author.publicPageEnabled) {
    throw new DomainError(
      'CONTENT_PUBLIC_VISIBILITY_NOT_ALLOWED',
      'A public publication needs the public page of its author',
    );
  }
}

/**
 * Visibility applied at read time: a `public` publication of a member whose public page is
 * disabled is read as `members`, even before the worker rewrites it.
 */
export function effectiveVisibility(
  post: Pick<PostRecord, 'visibility' | 'organizationId'>,
  authorPublicPageEnabled: boolean,
): PostVisibility {
  if (post.visibility === 'public' && post.organizationId === null && !authorPublicPageEnabled) {
    return 'members';
  }
  return post.visibility;
}

/** What a reader is, relative to the author of a publication. */
export interface ReaderContext {
  /** Null for an anonymous reader of a public page. */
  viewerId: string | null;
  connectedToAuthor: boolean;
  blockedWithAuthor: boolean;
}

/** Whether a reader may see a publication (feeds, pages, reposts, interactions). */
export function canView(
  post: Pick<PostRecord, 'authorId' | 'deletedAt' | 'moderationStatus' | 'organizationId'>,
  visibility: PostVisibility,
  reader: ReaderContext,
): boolean {
  if (post.deletedAt || post.moderationStatus === 'removed') return false;
  const isAuthor = reader.viewerId !== null && reader.viewerId === post.authorId;
  if (post.moderationStatus === 'hidden' && !isAuthor) return false;
  if (reader.blockedWithAuthor) return false;
  switch (visibility) {
    case 'public':
      return true;
    case 'members':
      return reader.viewerId !== null;
    case 'connections':
      return isAuthor || reader.connectedToAuthor;
  }
}

/**
 * A repost never widens the audience of the original (ADR 0031): a public publication may be
 * reposted with any visibility, a members-only one to members or connections, a
 * connections-only one by its author only.
 */
export function assertRepostAllowed(
  original: Pick<PostRecord, 'authorId'>,
  originalVisibility: PostVisibility,
  reposterId: string,
  repostVisibility: PostVisibility,
): void {
  const allowed =
    originalVisibility === 'public' ||
    (originalVisibility === 'members' && repostVisibility !== 'public') ||
    (originalVisibility === 'connections' &&
      original.authorId === reposterId &&
      repostVisibility === 'connections');
  if (!allowed) {
    throw new DomainError('CONTENT_REPOST_NOT_ALLOWED', 'The repost would widen the audience');
  }
}

/** The original of a repost chain: reposting a repost reposts its original. */
export function repostTarget(post: Pick<PostRecord, 'id' | 'kind' | 'repostOfId'>): string {
  return post.kind === 'repost' && post.repostOfId ? post.repostOfId : post.id;
}
