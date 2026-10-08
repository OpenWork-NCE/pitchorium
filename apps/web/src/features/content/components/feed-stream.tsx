import type { FeedPage, Suggestion } from '@pitchorium/contracts';
import { Newspaper } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/ui';
import { FeedEntries, modulesUsed, shownItems, suggestionModules } from './feed-entries';
import { FeedMore } from './feed-more';

interface FeedStreamProps {
  /** First page, read by the server; null if the api could not answer (read by the browser). */
  initialPage: FeedPage | null;
  /** People suggested to the member, shown among the items on a narrow screen. */
  suggestions: readonly Suggestion[];
}

/**
 * The feed (§10.3, ADR 0032): its items as the api orders them, then the next pages on demand.
 * On a narrow screen, where the side columns are not shown, the suggestions come among the items:
 * three after the third item, then three every ten items. Publications, reposts and highlights
 * show; a type the web does not draw yet (project update, event) is left out, as the contract
 * asks of an unknown type. The first page is rendered by the server (its dates, its cut texts
 * and its reactions are the only islands to hydrate); FeedMore reads the next ones.
 */
export function FeedStream({ initialPage, suggestions }: FeedStreamProps) {
  const t = useTranslations('web.feed');
  const modules = suggestionModules(suggestions);
  if (!initialPage) return <FeedMore cursor={null} shown={0} modules={modules} first />;
  const items = shownItems(initialPage.items);
  const used = modulesUsed(items.length, modules.length);
  return (
    <div className="grid gap-4">
      {items.length === 0 ? (
        <EmptyState icon={<Newspaper />} title={t('emptyTitle')} description={t('emptyBody')} />
      ) : null}
      <FeedEntries items={items} modules={modules} />
      <FeedMore
        cursor={initialPage.nextCursor}
        shown={items.length}
        modules={modules.slice(used)}
      />
    </div>
  );
}
