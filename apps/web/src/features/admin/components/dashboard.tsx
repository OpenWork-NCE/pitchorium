import type { ConsoleQueue, ConsoleQueues, PlatformStats } from '@pitchorium/contracts';
import { ChevronRight } from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Card, Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format/money';
import { ProjectsChart } from './projects-chart';

/** The screen each queue opens (direct link from the dashboard). */
const QUEUE_LINKS: Readonly<Record<ConsoleQueue, string>> = {
  moderation_cases: routes.adminModeration,
  appeals: routes.adminAppeals,
  organization_verifications: routes.adminOrganizations,
  kyc_reviews: routes.adminKyc,
  offline_contributions: routes.adminOffline,
  discrepancies: routes.adminDiscrepancies,
  failed_jobs: routes.adminJobs,
  rights_requests: routes.adminRights,
};

/**
 * The dashboard of the console: the queues the reader may work in, each with what waits in it
 * and its link, then, for an administrator, the figures of the platform as the api gives them
 * (members, projects by status, collected amount in euro equivalent, contributions).
 */
export async function Dashboard({
  queues,
  stats,
}: {
  queues: ConsoleQueues;
  /** Null for a moderator: the figures of the platform are an administrator's. */
  stats: PlatformStats | null;
}) {
  const t = await getTranslations('web.admin.dashboard');
  const reference = await getTranslations('reference.projectStatuses');
  const format = await getFormatter();
  const locale = await getLocale();
  const number = (value: number) => format.number(value);
  return (
    <div className="grid gap-8">
      <section aria-labelledby="queues-title" className="grid gap-3">
        <Heading level={2} size="section" id="queues-title">
          {t('queues')}
        </Heading>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {queues.items.map((item) => (
            <li key={item.queue}>
              <Link
                href={QUEUE_LINKS[item.queue]}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 outline-none hover:border-accent focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">{t(`queue.${item.queue}`)}</span>
                  <span className="text-sm text-muted">
                    {item.count === 0 ? t('empty') : t('waiting', { count: number(item.count) })}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className={
                      item.count > 0
                        ? 'font-numeric text-2xl font-extrabold tabular-nums'
                        : 'font-numeric text-2xl font-extrabold text-muted tabular-nums'
                    }
                  >
                    {number(item.count)}
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-muted" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {stats ? (
        <section aria-labelledby="figures-title" className="grid gap-4">
          <Heading level={2} size="section" id="figures-title">
            {t('figures')}
          </Heading>
          <Card className="p-5">
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  { key: 'members', value: number(stats.members.total) },
                  { key: 'active', value: number(stats.members.active30Days) },
                  {
                    key: 'collected',
                    value: formatMoney(
                      { amountMinor: stats.contributions.collectedEurMinor, currency: 'EUR' },
                      locale,
                    ),
                  },
                  { key: 'contributions', value: number(stats.contributions.succeeded) },
                ] as const
              ).map((figure) => (
                <div key={figure.key} className="grid content-start gap-1">
                  <dt className="text-sm text-muted">{t(`figure.${figure.key}`)}</dt>
                  <dd className="font-numeric text-3xl font-extrabold tabular-nums">
                    {figure.value}
                  </dd>
                </div>
              ))}
            </dl>
            <Text size="sm" tone="muted" className="mt-3">
              {t('collectedNote')}
            </Text>
          </Card>
          <Card className="p-5">
            <ProjectsChart
              data={Object.entries(stats.projects).map(([status, count]) => ({
                key: status,
                value: count,
                label: reference.has(status as never) ? reference(status as never) : status,
                description: reference.has(status as never) ? reference(status as never) : status,
                formatted: number(count),
              }))}
            />
          </Card>
        </section>
      ) : (
        <Text tone="muted">{t('moderatorScope')}</Text>
      )}
    </div>
  );
}
