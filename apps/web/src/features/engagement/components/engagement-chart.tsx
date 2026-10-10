'use client';

import type { ImpactDashboard } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { BarChart, Button, Link } from '@/components/ui';
import { peakIndex } from '@/components/ui/chart-scale';
import { routes } from '@/config/routes';
import { formatCompactMoney, formatMoney } from '@/lib/format/money';
import { monthlyValues } from '../lib/chart';

/**
 * The money given over the last twelve months (section 9.4, ADR 0144): the total of the api and
 * the month of the peak above the chart, the months on the horizontal axis, round amounts on the
 * vertical one, the amount of each month on hover and focus; an empty state with the way to the
 * projects when nothing was given. The card around it carries the title.
 */
export function EngagementChart({
  monthly,
  total,
}: {
  monthly: ImpactDashboard['monthly'];
  /** Net euros of the twelve months, from the api. */
  total: ImpactDashboard['givenLastTwelveMonths'];
}) {
  const t = useTranslations('web.engagement.chart');
  const locale = useLocale();
  const date = (month: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
      new Date(`${month}-01T00:00:00Z`),
    );
  const values = monthlyValues(monthly);
  const data = monthly.map((entry, index) => ({
    key: entry.month,
    value: values[index]!,
    label: date(entry.month, { month: 'short' }),
    description: date(entry.month, { month: 'long', year: 'numeric' }),
    formatted: formatMoney(entry.given, locale),
  }));
  const peak = peakIndex(values);
  const currency = monthly[0]?.given.currency ?? total.currency;
  return (
    <BarChart
      data={data}
      title={t('title')}
      summary={
        peak === -1
          ? null
          : t('summary', {
              total: formatMoney(total, locale),
              count: monthly.length,
              month: data[peak]!.description,
              amount: data[peak]!.formatted,
            })
      }
      formatTick={(value) => formatCompactMoney(value, currency, locale)}
      columns={{ category: t('month'), value: t('given') }}
      empty={{
        title: t('emptyTitle', { count: monthly.length }),
        description: t('emptyDescription'),
        action: (
          <Button asChild variant="primary" size="sm">
            <Link href={routes.projects}>{t('discover')}</Link>
          </Button>
        ),
      }}
    />
  );
}
