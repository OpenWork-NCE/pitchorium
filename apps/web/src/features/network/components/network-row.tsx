import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';

/** What a row of a list of the network shows: a member, an organization or a project. */
export interface NetworkRowItem {
  key: string;
  /** Type of the target: `member`, `organization`, `project`, or one a module added later. */
  type: string;
  name: string;
  /** Public key of its page (handle or slug); no link without one. */
  slug: string | null;
  subtitle: string | null;
  imageUrl: string | null;
}

function pageOf(item: NetworkRowItem): string | null {
  if (item.slug === null) return null;
  if (item.type === 'member') return routes.member(item.slug);
  if (item.type === 'organization') return routes.organization(item.slug);
  if (item.type === 'project') return routes.project(item.slug);
  return null;
}

/**
 * A row of a list of the network for a visitor, without any hook: rendered by the server for
 * the first page, by the browser for the next ones (VisitorListMore).
 */
export function NetworkRow({ item, meta }: { item: NetworkRowItem; meta: ReactNode }) {
  const href = pageOf(item);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-3">
      <Avatar
        name={item.name}
        src={item.imageUrl}
        size="lg"
        shape={item.type === 'member' ? 'circle' : 'square'}
        decorative
      />
      <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
        <span className="font-medium">
          {href ? (
            <Link href={href} className="link-underline-hover">
              {item.name}
            </Link>
          ) : (
            item.name
          )}
        </span>
        {item.subtitle ? <p className="line-clamp-2 text-sm text-muted">{item.subtitle}</p> : null}
        <p className="text-xs text-muted">{meta}</p>
      </div>
    </li>
  );
}
