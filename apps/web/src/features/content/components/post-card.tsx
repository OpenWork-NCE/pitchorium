import type { Post } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Avatar, Card, RelativeTime, Truncate } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { ReactionSummary } from './reaction-summary';

interface PostCardProps {
  post: Post;
  /** Actions of the reader (react, comment, share), under the summary. */
  actions?: ReactNode;
  className?: string;
}

/**
 * A publication of the feed (§10.3): its author and when, its text cut after a few lines, the
 * summary of its reactions and the count of its comments. Its actions come from the page.
 */
export function PostCard({ post, actions, className }: PostCardProps) {
  const t = useTranslations('web.content');
  const locale = useLocale();
  const author =
    post.author.type === 'member'
      ? {
          name: post.author.member.displayName,
          subtitle: post.author.member.headline,
          image: post.author.member.avatarUrl,
          href: routes.member(post.author.member.handle),
          shape: 'circle' as const,
        }
      : {
          name: post.author.organization.name,
          subtitle: null,
          image: post.author.organization.logoUrl,
          href: routes.organization(post.author.organization.slug),
          shape: 'square' as const,
        };
  const comments =
    new Intl.PluralRules(locale).select(post.commentCount) === 'one' ? 'one' : 'other';
  return (
    <article aria-label={t('postBy', { name: author.name })} className={className}>
      <Card padding="none" className="grid gap-3 p-4 sm:p-5">
        <header className="flex items-start gap-3">
          <Avatar name={author.name} src={author.image} shape={author.shape} decorative />
          <div className="grid min-w-0 flex-1">
            <Link
              href={author.href}
              className="w-fit max-w-full truncate rounded-xs font-semibold outline-none hover:underline focus-visible:outline-2 focus-visible:outline-focus"
            >
              {author.name}
            </Link>
            {author.subtitle ? (
              <p className="truncate text-sm text-muted">{author.subtitle}</p>
            ) : null}
            <p className="text-xs text-muted">
              <RelativeTime date={post.createdAt} />
              {post.editedAt ? <span> · {t('edited')}</span> : null}
            </p>
          </div>
        </header>
        {post.text ? (
          <Truncate lines={4}>
            <p className="text-pretty whitespace-pre-line">{post.text}</p>
          </Truncate>
        ) : null}
        {post.reactions.total > 0 || post.commentCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
            <ReactionSummary reactions={post.reactions} />
            {post.commentCount > 0 ? (
              <span className="tabular-nums">
                {t(`comments.${comments}`, {
                  count: new Intl.NumberFormat(locale).format(post.commentCount),
                })}
              </span>
            ) : null}
          </div>
        ) : null}
        {actions ? (
          <div className={cn('-mx-2 flex flex-wrap border-t border-border pt-2')}>{actions}</div>
        ) : null}
      </Card>
    </article>
  );
}
