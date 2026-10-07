import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../platform/kernel';
import { assertCommentsOpen, assertReplyable, type CommentRecord, commentRoles } from './comment';
import { resolveLanguage } from './language';
import { extractMentionKeys, MAX_MENTIONS, resolveMentions } from './mentions';
import { parseOpenGraph } from './open-graph';
import {
  assertPublishable,
  assertRepostAllowed,
  assertVisibilityAllowed,
  canView,
  effectiveVisibility,
  repostTarget,
} from './post';
import { reactionChange } from './reactions';

const codeOf = (work: () => unknown) => {
  try {
    work();
    return 'none';
  } catch (error) {
    return error instanceof DomainError ? error.code : 'unexpected';
  }
};

const post = {
  authorId: 'author',
  organizationId: null,
  deletedAt: null,
  moderationStatus: 'visible' as const,
};
const reader = (overrides: Partial<Parameters<typeof canView>[2]> = {}) => ({
  viewerId: 'reader',
  connectedToAuthor: false,
  blockedWithAuthor: false,
  ...overrides,
});

describe('publications', () => {
  it('needs some content, and images or a document, not both', () => {
    const draft = { text: null, imageCount: 0, hasDocument: false, hasLink: false };
    expect(codeOf(() => assertPublishable(draft))).toBe('CONTENT_POST_EMPTY');
    expect(codeOf(() => assertPublishable({ ...draft, hasLink: true }))).toBe('none');
    expect(codeOf(() => assertPublishable({ ...draft, imageCount: 2, hasDocument: true }))).toBe(
      'CONTENT_MEDIA_COMBINATION',
    );
  });

  it('allows public only with the public page of a member author', () => {
    expect(
      codeOf(() => assertVisibilityAllowed('public', { kind: 'member', publicPageEnabled: false })),
    ).toBe('CONTENT_PUBLIC_VISIBILITY_NOT_ALLOWED');
    expect(
      codeOf(() => assertVisibilityAllowed('public', { kind: 'member', publicPageEnabled: true })),
    ).toBe('none');
    expect(codeOf(() => assertVisibilityAllowed('connections', { kind: 'organization' }))).toBe(
      'CONTENT_VISIBILITY_NOT_ALLOWED',
    );
    expect(codeOf(() => assertVisibilityAllowed('public', { kind: 'organization' }))).toBe('none');
  });

  it('reads a public publication as members-only once the public page is disabled', () => {
    expect(effectiveVisibility({ visibility: 'public', organizationId: null }, false)).toBe(
      'members',
    );
    expect(effectiveVisibility({ visibility: 'public', organizationId: null }, true)).toBe(
      'public',
    );
    expect(effectiveVisibility({ visibility: 'public', organizationId: 'org' }, false)).toBe(
      'public',
    );
  });

  it('shows a publication according to its audience, blocks and moderation', () => {
    expect(canView(post, 'public', reader({ viewerId: null }))).toBe(true);
    expect(canView(post, 'members', reader({ viewerId: null }))).toBe(false);
    expect(canView(post, 'members', reader())).toBe(true);
    expect(canView(post, 'connections', reader())).toBe(false);
    expect(canView(post, 'connections', reader({ connectedToAuthor: true }))).toBe(true);
    expect(canView(post, 'connections', reader({ viewerId: 'author' }))).toBe(true);
    expect(canView(post, 'public', reader({ blockedWithAuthor: true }))).toBe(false);
    expect(canView({ ...post, moderationStatus: 'hidden' }, 'public', reader())).toBe(false);
    expect(
      canView({ ...post, moderationStatus: 'hidden' }, 'public', reader({ viewerId: 'author' })),
    ).toBe(true);
    expect(canView({ ...post, moderationStatus: 'removed' }, 'public', reader())).toBe(false);
    expect(canView({ ...post, deletedAt: new Date() }, 'public', reader())).toBe(false);
  });

  it('never reposts a publication outside of its audience', () => {
    const original = { authorId: 'author' };
    expect(codeOf(() => assertRepostAllowed(original, 'public', 'other', 'public'))).toBe('none');
    expect(codeOf(() => assertRepostAllowed(original, 'members', 'other', 'connections'))).toBe(
      'none',
    );
    expect(codeOf(() => assertRepostAllowed(original, 'members', 'other', 'public'))).toBe(
      'CONTENT_REPOST_NOT_ALLOWED',
    );
    expect(codeOf(() => assertRepostAllowed(original, 'connections', 'other', 'connections'))).toBe(
      'CONTENT_REPOST_NOT_ALLOWED',
    );
    expect(
      codeOf(() => assertRepostAllowed(original, 'connections', 'author', 'connections')),
    ).toBe('none');
    expect(repostTarget({ id: 'r', kind: 'repost', repostOfId: 'o' })).toBe('o');
    expect(repostTarget({ id: 'o', kind: 'post', repostOfId: null })).toBe('o');
  });
});

describe('mentions', () => {
  it('extracts distinct handles and slugs, not emails nor partial words', () => {
    const text =
      'Merci @aissatou-ba et @Fondation-Teranga ! Écrivez à contact@teranga.org, @aissatou-ba.\n@ab @x-- @kofi_mensah';
    expect(extractMentionKeys(text)).toEqual(['aissatou-ba', 'fondation-teranga']);
    expect(extractMentionKeys(null)).toEqual([]);
    expect(extractMentionKeys('(@kofi-mensah)')).toEqual(['kofi-mensah']);
  });

  it(`keeps at most ${MAX_MENTIONS} mentions`, () => {
    const text = Array.from({ length: 30 }, (_, index) => `@member-${index + 100}`).join(' ');
    expect(extractMentionKeys(text)).toHaveLength(MAX_MENTIONS);
  });

  it('resolves members first, then organizations, and drops unknown keys', () => {
    const resolved = resolveMentions(
      ['ama', 'teranga', 'nobody'],
      new Map([['ama', 'user-1']]),
      new Map([
        ['teranga', 'org-1'],
        ['ama', 'org-2'],
      ]),
    );
    expect(resolved).toEqual([
      { token: '@ama', targetType: 'member', targetId: 'user-1' },
      { token: '@teranga', targetType: 'organization', targetId: 'org-1' },
    ]);
  });
});

describe('comments', () => {
  const comment = (overrides: Partial<CommentRecord> = {}): CommentRecord => ({
    id: 'c-1',
    postId: 'p-1',
    parentId: null,
    authorId: 'commenter',
    text: 'Bravo',
    moderationStatus: 'visible',
    createdAt: new Date(),
    editedAt: null,
    deletedAt: null,
    ...overrides,
  });

  it('answers top-level comments of the same publication only', () => {
    expect(assertReplyable(comment(), 'p-1').id).toBe('c-1');
    expect(codeOf(() => assertReplyable(comment({ parentId: 'c-0' }), 'p-1'))).toBe(
      'CONTENT_REPLY_DEPTH',
    );
    expect(codeOf(() => assertReplyable(comment(), 'p-2'))).toBe('CONTENT_COMMENT_NOT_FOUND');
    expect(codeOf(() => assertReplyable(comment({ deletedAt: new Date() }), 'p-1'))).toBe(
      'CONTENT_COMMENT_NOT_FOUND',
    );
    expect(codeOf(() => assertReplyable(null, 'p-1'))).toBe('CONTENT_COMMENT_NOT_FOUND');
  });

  it('refuses comments when the author disabled them', () => {
    expect(codeOf(() => assertCommentsOpen({ commentsDisabled: true }))).toBe(
      'CONTENT_COMMENTS_DISABLED',
    );
    expect(codeOf(() => assertCommentsOpen({ commentsDisabled: false }))).toBe('none');
  });

  it('gives deletion roles to the comment author and the publication author', () => {
    expect(commentRoles(comment(), 'author', 'commenter')).toEqual(['author']);
    expect(commentRoles(comment(), 'author', 'author')).toEqual(['post_author']);
    expect(commentRoles(comment({ authorId: 'author' }), 'author', 'author')).toEqual([
      'author',
      'post_author',
    ]);
    expect(commentRoles(comment(), 'author', 'stranger')).toEqual([]);
  });
});

describe('language, reactions and link previews', () => {
  it('prefers the declared language, then the detected one', () => {
    expect(resolveLanguage('fr', 'en')).toEqual({ language: 'fr', languageSource: 'declared' });
    expect(resolveLanguage(undefined, 'sw')).toEqual({
      language: 'sw',
      languageSource: 'detected',
    });
    expect(resolveLanguage(null, null)).toEqual({ language: null, languageSource: 'undetermined' });
  });

  it('tells how a reaction changes', () => {
    expect(reactionChange(null, 'like')).toBe('added');
    expect(reactionChange('like', 'bravo')).toBe('changed');
    expect(reactionChange('like', null)).toBe('removed');
    expect(reactionChange('like', 'like')).toBe('unchanged');
  });

  it('reads Open Graph tags with fallbacks and resolves the image URL', () => {
    const html = `<html><head><title>Fallback</title>
      <meta content="Sahel Agri &amp; Co" property="og:title">
      <meta name='description' content='Coopérative &#233;nergie solaire'>
      <meta property="og:site_name" content="Sahel Agri"/>
      <meta property="og:image" content="/images/cover.jpg"></head><body></body></html>`;
    expect(parseOpenGraph(html, 'https://sahel.example/projets/1')).toEqual({
      title: 'Sahel Agri & Co',
      description: 'Coopérative énergie solaire',
      siteName: 'Sahel Agri',
      imageUrl: 'https://sahel.example/images/cover.jpg',
    });
    expect(
      parseOpenGraph(
        '<title> Juste un titre </title><meta property="og:image" content="javascript:alert(1)">',
        'https://x.example/',
      ),
    ).toEqual({ title: 'Juste un titre', description: null, siteName: null, imageUrl: null });
  });
});
