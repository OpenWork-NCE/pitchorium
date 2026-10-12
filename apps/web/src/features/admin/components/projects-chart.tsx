'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { BarChart, type BarChartDatum } from '@/components/ui';

/** Projects by status as the api counts them, in the bar chart of the design system (ADR 0144). */
export function ProjectsChart({ data }: { data: readonly BarChartDatum[] }) {
  const t = useTranslations('web.admin.dashboard');
  const format = useFormatter();
  const total = data.reduce((sum, datum) => sum + datum.value, 0);
  return (
    <BarChart
      data={data}
      title={t('projects')}
      showTitle
      headingLevel={3}
      summary={t('projectsSummary', { count: format.number(total) })}
      formatTick={(value) => format.number(value)}
      columns={{ category: t('status'), value: t('count') }}
      empty={{ title: t('noProject') }}
    />
  );
}
