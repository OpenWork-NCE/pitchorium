import type { EmbeddedPost, Post } from '@pitchorium/contracts';
import { Repeat2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ComponentProps, ReactNode } from 'react';
import { Button, Card, Notice } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { withRedirect } from '@/lib/auth/redirect';
import { FeaturedLabel, PostHeader, postAuthor } from './post/post-header';
import { PostDocument } from './post/post-document';
import { PostImages } from './post/post-images';
import { PostLink } from './post/post-link';
import { LazyPostProject } from './post/lazy-post-project';
import { PostText } from './post/post-text';
import { ReactionSummary } from './reaction-summary';

interface PostCardProps extends Omit<ComponentProps<'article'>, 'children'> {
  post: Post;
  /** A member reads it: its actions, its project, its document open. */
  signedIn: boolean;
  /** An editorial highlight (« À la une »). */
  featured?: boolean;
  /** The menu of the reader (save, hide, edit...). */
  menu?: ReactNode;
  /** The name of the author with its preview (member readers). */
  name?: ReactNode;
  /** Under the content: the summary and the actions of a member. */
  footer?: ReactNode;
  /** The whole text, never cut (page of the publication). */
  full?: boolean;
  /** Address to come back to after a visitor signs in. */
  returnTo?: string;
}

/**
 * A publication (§10.3), shared by the server (pages, first page of a list) and the browser (the
 * feed): its author, its text with its mentions and links, its images, its document, its link,
 * its project; a repost shows its comment then the original, inside; a publication hidden by the
 * moderation says so to its author, the only one who still reads it. A member gets the footer of
 * actions; a visitor the summary and the way to sign in.
 */
export function PostCard({
  post,
  signedIn,
  featured = false,
  menu,
  name,
  footer,
  full = false,
  returnTo,
  className,
  ...article
}: PostCardProps) {
  const t = useTranslations('web.content');
  const locale = useLocale();
  const author = postAuthor(post);
  return (
    <article aria-label={t('postBy', { name: author.name })} className={className} {...article}>
      <Card padding="none" className="grid gap-3 p-4 sm:p-5">
        {post.moderation === 'hidden' ? <Notice kind="moderated" /> : null}
        {featured ? <FeaturedLabel /> : null}
        {post.kind === 'repost' ? (
          <p className="-mb-1 flex items-center gap-1.5 text-xs text-muted">
            <Repeat2 aria-hidden className="size-4" />
            {t('repostedBy', { name: author.name })}
          </p>
        ) : null}
        <PostHeader post={post} name={name} menu={menu} />
        <PostBody post={post} signedIn={signedIn} full={full} />
        {post.kind === 'repost' ? (
          post.repostOf ? (
            <div className="grid gap-3 rounded-lg border border-border p-3 sm:p-4">
              <PostHeader post={post.repostOf} size="sm" />
              <PostBody post={post.repostOf} signedIn={signedIn} full={full} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">
              {t('repostUnavailable')}
            </p>
          )
        ) : null}
        {footer ??
          (post.reactions.total > 0 || !signedIn ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted">
              <ReactionSummary reactions={post.reactions} />
              {signedIn ? null : (
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={withRedirect(
                      routes.signIn,
                      returnTo ?? `/${locale}${routes.post(post.id)}`,
                    )}
                  >
                    {t('actions.signInToReact')}
                  </Link>
                </Button>
              )}
            </div>
          ) : null)}
      </Card>
    </article>
  );
}

/** What a publication holds, in this order: text, images or document, link, project. */
function PostBody({
  post,
  signedIn,
  full,
}: {
  post: EmbeddedPost;
  signedIn: boolean;
  full: boolean;
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        !post.text && !post.images.length && !post.document && !post.link && 'hidden',
      )}
    >
      {post.text ? <PostText text={post.text} mentions={post.mentions} full={full} /> : null}
      {post.images.length > 0 ? <PostImages images={post.images} postId={post.id} /> : null}
      {post.document ? <PostDocument document={post.document} signedIn={signedIn} /> : null}
      {post.link ? <PostLink link={post.link} /> : null}
      {post.projectId && signedIn ? <LazyPostProject projectId={post.projectId} /> : null}
    </div>
  );
}
