'use client';

import { useTranslations } from 'next-intl';
import { usePlural } from '@/lib/i18n/plural';
import { Button } from './button';

interface PaginationProps {
  /** `nextCursor` of the api is not null. */
  hasMore: boolean;
  /** Loads the next page (`?cursor=`), appended to the list. */
  onLoadMore: () => void;
  loading?: boolean;
  /** Items shown so far, to announce where the list stands. */
  shown?: number;
  className?: string;
}

/**
 * Cursor pagination of the api (`{ items, nextCursor }`, frontend handoff): "load more" appends
 * the next page; the end of the list is said. The focus stays on the button, the new items
 * follow the ones already read.
 */
export function Pagination({
  hasMore,
  onLoadMore,
  loading = false,
  shown,
  className,
}: PaginationProps) {
  const t = useTranslations('web.ui.pagination');
  const plural = usePlural();
  return (
    <div className={className}>
      <p aria-live="polite" className="sr-only">
        {shown !== undefined ? t(`shown.${plural(shown)}`, { count: shown }) : null}
      </p>
      {hasMore ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            loading={loading}
            loadingLabel={t('loading')}
          >
            {t('more')}
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">{t('end')}</p>
      )}
    </div>
  );
}
