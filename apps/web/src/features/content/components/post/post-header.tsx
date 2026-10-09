import type { Post, PostVisibility } from '@pitchorium/contracts';
import { Globe, Handshake, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Avatar, Badge, RelativeTime, VerifiedBadge } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';

const VISIBILITY_ICONS: Record<PostVisibility, typeof Globe> = {
  public: Globe,
  members: Users,
  connections: Handshake,
};

/** What the header shows of the author: a member (their card) or an organization. */
export function postAuthor(post: Pick<Post, 'author'>) {
  return post.author.type === 'member'
    ? {
        name: post.author.member.displayName,
        subtitle: post.author.member.headline,
        image: post.author.member.avatarUrl,
        href: routes.member(post.author.member.handle),
        shape: 'circle' as const,
        verified: false,
      }
    : {
        name: post.author.organization.name,
        subtitle: null,
        image: post.author.organization.logoUrl,
        href: routes.organization(post.author.organization.slug),
        shape: 'square' as const,
        verified: post.author.organization.verified,
      };
}

/**
 * Head of a publication: the author with their preview on hover for a member reader (`name`),
 * their title, when, the audience as an icon with its name, « modifiée », then the menu.
 */
export function PostHeader({
  post,
  name,
  menu,
  size = 'md',
}: {
  post: Pick<Post, 'author' | 'createdAt' | 'editedAt' | 'visibility'>;
  /** The name as a link with the preview of the member (member readers). */
  name?: ReactNode;
  menu?: ReactNode;
  size?: 'sm' | 'md';
}) {
  const t = useTranslations('web.content');
  const audiences = useTranslations('reference.postVisibilities');
  const author = postAuthor(post);
  const VisibilityIcon = VISIBILITY_ICONS[post.visibility];
  const audience = t('visibility', { audience: audiences(post.visibility) });
  return (
    <header className="flex items-start gap-3">
      <Avatar
        name={author.name}
        src={author.image}
        shape={author.shape}
        size={size === 'sm' ? 'sm' : 'md'}
        decorative
      />
      <div className="grid min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          {name ?? (
            <Link
              href={author.href}
              // A feed lists dozens of authors: their pages are not fetched in advance.
              prefetch={false}
              className="truncate rounded-xs font-semibold outline-none hover:underline focus-visible:outline-2 focus-visible:outline-focus"
            >
              {author.name}
            </Link>
          )}
          {author.verified ? <VerifiedBadge /> : null}
        </span>
        {author.subtitle ? <p className="truncate text-sm text-muted">{author.subtitle}</p> : null}
        <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
          <RelativeTime date={post.createdAt} />
          <span aria-hidden>·</span>
          <span className="inline-flex items-center" title={audience}>
            <VisibilityIcon aria-hidden className="size-3.5" />
            <span className="sr-only">{audience}</span>
          </span>
          {post.editedAt ? (
            <>
              <span aria-hidden>·</span>
              <span>{t('edited')}</span>
            </>
          ) : null}
        </p>
      </div>
      {menu}
    </header>
  );
}

/** « À la une » above an editorial highlight. */
export function FeaturedLabel() {
  const t = useTranslations('web.content');
  return (
    <Badge tone="accent" className="w-fit">
      {t('featured')}
    </Badge>
  );
}
