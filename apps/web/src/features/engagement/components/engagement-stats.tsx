'use client';

import type { ImpactDashboard } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { Stat } from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import { hoursAndMinutes } from '../lib/chart';

/**
 * The key figures of the engagement (section 9.4): euros really given this month and since the
 * start, projects supported, hours declared and confirmed. Each counts once on arrival (H17) in
 * whole minor units or minutes, never through a floating point amount; the final value is the
 * api's.
 */
export function EngagementStats({
  dashboard,
  hours,
}: {
  dashboard: ImpactDashboard;
  /** The hours are personal: a member's dashboard only. */
  hours: boolean;
}) {
  const t = useTranslations('web.engagement.stats');
  const locale = useLocale();
  const money = (currency: string) => (value: number) =>
    formatMoney({ amountMinor: String(Math.round(value)), currency }, locale);
  const duration = (value: number) => {
    const { hours: h, minutes } = hoursAndMinutes(Math.round(value));
    return t('duration', { hours: h, minutes: String(minutes).padStart(2, '0') });
  };
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="engagement-stats">
      <Stat
        className="rounded-2xl border border-border bg-surface p-5"
        label={t('thisMonth')}
        value={Number(dashboard.givenThisMonth.amountMinor)}
        format={money(dashboard.givenThisMonth.currency)}
      />
      <Stat
        className="rounded-2xl border border-border bg-surface p-5"
        label={t('total')}
        value={Number(dashboard.givenTotal.amountMinor)}
        format={money(dashboard.givenTotal.currency)}
      />
      <Stat
        className="rounded-2xl border border-border bg-surface p-5"
        label={t('projects')}
        value={dashboard.projectsSupported}
        format={(value) => new Intl.NumberFormat(locale).format(Math.round(value))}
      />
      {hours ? (
        <Stat
          className="rounded-2xl border border-border bg-surface p-5"
          label={t('hoursDeclared')}
          value={dashboard.minutes.declared}
          format={duration}
          hint={t('hoursConfirmed', { duration: duration(dashboard.minutes.confirmed) })}
        />
      ) : null}
    </dl>
  );
}
