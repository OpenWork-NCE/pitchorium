import { ApiProblemError } from '@pitchorium/api-client';
import { Lock } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { configureServerApi } from '@/lib/api/server';
import { cn } from '@/lib/cn';
import {
  VISITOR_FOLLOW_TYPES,
  VISITOR_LIST_TABS,
  type VisitorFollowType,
  type VisitorListPage,
  type VisitorListTab,
  visitorListPage,
} from '../lib/visitor-lists';
import { NetworkRow } from './network-row';
import { VisitorListMore } from './visitor-list-more';

const SINCE = {
  connections: 'connectedSince',
  followers: 'followerSince',
  following: 'followingSince',
} as const;

/** A list the member does not show to visitors: hidden, or absent without their public page. */
function isHidden(error: unknown): boolean {
  return (
    error instanceof ApiProblemError &&
    (error.problem.code === 'NETWORK_LIST_HIDDEN' || error.problem.status === 404)
  );
}

const linkClass = (current: boolean) =>
  cn(
    'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium',
    current ? 'bg-accent-subtle text-on-accent-subtle' : 'text-muted hover:text-foreground',
  );

/**
 * The lists of a member read by a visitor (§10.2), rendered by the server: the lists as links
 * (`?tab=`, `?type=`), the first page, then « Afficher plus » in the browser. The member view
 * keeps its tabs and its actions (MemberLists); a visitor's first load stays light (ADR 0094).
 */
export async function VisitorMemberLists({
  handle,
  name,
  tab,
  type,
}: {
  handle: string;
  name: string;
  tab: VisitorListTab;
  type: VisitorFollowType;
}) {
  const [t, format] = await Promise.all([getTranslations('web.network.lists'), getFormatter()]);
  configureServerApi();
  let page: VisitorListPage | null = null;
  try {
    page = await visitorListPage(handle, tab, type, undefined);
  } catch (error) {
    if (!isHidden(error)) throw error;
  }
  const href = (next: { tab?: VisitorListTab; type?: VisitorFollowType }) => ({
    pathname: routes.memberNetwork(handle),
    query: {
      ...((next.tab ?? tab) === 'connections' ? {} : { tab: next.tab ?? tab }),
      ...(next.type && next.type !== 'all' ? { type: next.type } : {}),
    },
  });
  return (
    <div className="grid gap-4">
      <nav aria-label={t('label', { name })}>
        <ul className="flex flex-wrap gap-1 border-b border-border pb-2">
          {VISITOR_LIST_TABS.map((value) => (
            <li key={value}>
              <Link
                href={href({ tab: value })}
                aria-current={value === tab ? 'page' : undefined}
                className={linkClass(value === tab)}
              >
                {t(`tabs.${value}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {tab === 'following' ? (
        <nav aria-label={t('filter')}>
          <ul className="flex flex-wrap gap-1">
            {VISITOR_FOLLOW_TYPES.map((value) => (
              <li key={value}>
                <Link
                  href={href({ type: value })}
                  aria-current={value === type ? 'page' : undefined}
                  className={linkClass(value === type)}
                >
                  {t(`types.${value}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {page === null ? (
        <EmptyState
          size="inline"
          icon={<Lock />}
          title={t('hidden.title')}
          description={t('hidden.description')}
        />
      ) : page.entries.length === 0 ? (
        <EmptyState size="inline" title={t(`empty.${tab}`)} />
      ) : (
        <div className="grid gap-4">
          <ul className="grid gap-1" aria-label={t(`tabs.${tab}`)}>
            {page.entries.map((entry) => (
              <NetworkRow
                key={entry.item.key}
                item={entry.item}
                meta={t(SINCE[tab], {
                  date: format.dateTime(new Date(entry.since), { dateStyle: 'medium' }),
                })}
              />
            ))}
          </ul>
          <VisitorListMore
            key={`${tab}:${type}`}
            handle={handle}
            tab={tab}
            type={type}
            cursor={page.nextCursor}
            shown={page.entries.length}
          />
        </div>
      )}
    </div>
  );
}
