'use client';

import { usePostsControllerStats } from '@pitchorium/api-client';
import { useFormatter, useTranslations } from 'next-intl';
import { Dialog, DialogContent, ErrorState, Loading, Skeleton } from '@/components/ui';

const WIDTH = 320;
const HEIGHT = 120;

/**
 * Who saw a publication, for its author (§6.3, ADR 0034, ADR 0116): unique members per day as
 * bars in a small SVG drawn here (no chart library), the values in a table for screen readers
 * and as a title of each bar.
 */
export default function PostStats({ postId, onClose }: { postId: string; onClose: () => void }) {
  const t = useTranslations('web.content.stats');
  const format = useFormatter();
  const stats = usePostsControllerStats(postId, { query: { staleTime: 60_000 } });
  const days = stats.data?.days ?? [];
  const max = Math.max(1, ...days.map((day) => day.uniqueViewers));
  const bar = days.length ? WIDTH / days.length : WIDTH;
  const label = (day: { day: string; uniqueViewers: number }) =>
    t('day', {
      date: format.dateTime(new Date(`${day.day}T12:00:00Z`), { day: 'numeric', month: 'short' }),
      count: format.number(day.uniqueViewers),
    });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={t('title')} description={t('description')}>
        {stats.isPending ? (
          <Loading>
            <Skeleton className="h-32 w-full" />
          </Loading>
        ) : stats.isError ? (
          <ErrorState size="inline" title={t('error')} onRetry={() => void stats.refetch()} />
        ) : days.length === 0 ? (
          <p className="text-sm text-muted">{t('empty')}</p>
        ) : (
          <figure className="grid gap-2">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label={t('chart')}
              className="h-32 w-full"
              preserveAspectRatio="none"
            >
              {days.map((day, index) => {
                const height = Math.max(2, (day.uniqueViewers / max) * (HEIGHT - 4));
                return (
                  <rect
                    key={day.day}
                    x={index * bar + bar * 0.15}
                    y={HEIGHT - height}
                    width={bar * 0.7}
                    height={height}
                    rx={2}
                    className="fill-accent"
                  >
                    <title>{label(day)}</title>
                  </rect>
                );
              })}
            </svg>
            <figcaption className="text-xs text-muted">{t('chart')}</figcaption>
            <table className="sr-only">
              <caption>{t('chart')}</caption>
              <tbody>
                {days.map((day) => (
                  <tr key={day.day}>
                    <td>{label(day)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
}
