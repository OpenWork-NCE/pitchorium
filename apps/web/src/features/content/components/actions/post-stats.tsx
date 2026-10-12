'use client';

import { getPostsControllerStatsQueryOptions } from '@pitchorium/api-client';
import { useQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { BarChart, CopyButton, Dialog, DialogContent } from '@/components/ui';
import { peakIndex } from '@/components/ui/chart-scale';
import { usePlural } from '@/lib/i18n/plural';

/**
 * Who saw a publication, for its author (§6.3, ADR 0034, ADR 0116, ADR 0144): unique members per
 * day on the bar chart of the design system, the days followed and the peak above it, the dates on
 * the horizontal axis and the count of each day on hover and focus. The dialog carries the title;
 * a publication nobody saw yet offers to copy its link.
 */
export default function PostStats({
  postId,
  address,
  onClose,
}: {
  postId: string;
  /** Address of the publication, to share it when nobody saw it yet. */
  address: string;
  onClose: () => void;
}) {
  const t = useTranslations('web.content.stats');
  const format = useFormatter();
  const plural = usePlural();
  const stats = useQuery(
    getPostsControllerStatsQueryOptions(postId, { query: { staleTime: 60_000 } }),
  );
  const day = (date: string, style: 'short' | 'long') =>
    format.dateTime(
      new Date(`${date}T12:00:00Z`),
      style === 'short'
        ? { day: 'numeric', month: 'short', timeZone: 'UTC' }
        : { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' },
    );
  const data = stats.data?.days.map((entry) => ({
    key: entry.day,
    value: entry.uniqueViewers,
    label: day(entry.day, 'short'),
    description: day(entry.day, 'long'),
    formatted: t(`viewers.${plural(entry.uniqueViewers)}`, {
      count: format.number(entry.uniqueViewers),
    }),
  }));
  const peak = data ? peakIndex(data.map((entry) => entry.value)) : -1;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={t('title')}
        description={t('description')}
        // The dialog itself takes the focus: the first bar would open its tooltip at once.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        <BarChart
          data={data}
          state={stats.isError ? 'error' : stats.isPending ? 'loading' : 'ready'}
          onRetry={() => void stats.refetch()}
          title={t('chart')}
          summary={
            data && peak !== -1
              ? t('summary', {
                  days: t(`days.${plural(data.length)}`, { count: format.number(data.length) }),
                  peak: t(`peak.${plural(data[peak]!.value)}`, {
                    date: data[peak]!.description,
                    count: format.number(data[peak]!.value),
                  }),
                })
              : null
          }
          formatTick={(value) => format.number(value, { notation: 'compact' })}
          columns={{ category: t('day'), value: t('chart') }}
          empty={{
            title: t('empty'),
            description: t('emptyHint'),
            action: <CopyButton value={address} label={t('copyLink')} />,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
