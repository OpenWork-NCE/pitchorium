import type { TransparencyReport as Report } from '@pitchorium/contracts';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, Heading } from '@/components/ui';

/**
 * The transparency counters of a period (§13, ADR 0072), aggregated by the api without any
 * personal data: reports by reason and target, cases, decisions by kind, suspensions, appeals.
 */
export async function TransparencyReport({ report }: { report: Report }) {
  const t = await getTranslations('web.admin.moderation.transparency');
  const reference = await getTranslations('reference');
  const format = await getFormatter();
  const number = (value: number) => format.number(value);
  const table = (
    id: string,
    title: string,
    rows: readonly { key: string; label: string; value: string }[],
  ) => (
    <Card className="grid content-start gap-3 p-5" aria-labelledby={id}>
      <Heading level={2} size="card" id={id}>
        {title}
      </Heading>
      <table className="w-full text-sm">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border last:border-0">
              <th scope="row" className="py-2 text-left font-normal">
                {row.label}
              </th>
              <td className="py-2 text-right font-numeric tabular-nums">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
  const byReason = Object.entries(report.reports.byReason).map(([reason, count]) => ({
    key: reason,
    label: reference.has(`reportReasons.${reason}` as never)
      ? reference(`reportReasons.${reason}` as never)
      : reason,
    value: number(count),
  }));
  const byTarget = Object.entries(report.reports.byTargetType).map(([type, count]) => ({
    key: type,
    label: reference.has(`reportTargetTypes.${type}` as never)
      ? reference(`reportTargetTypes.${type}` as never)
      : type,
    value: number(count),
  }));
  const byKind = Object.entries(report.decisions.byKind).map(([kind, count]) => ({
    key: kind,
    label: reference.has(`moderationDecisionKinds.${kind}` as never)
      ? reference(`moderationDecisionKinds.${kind}` as never)
      : kind,
    value: number(count),
  }));
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {table('reports-total', t('reports'), [
        { key: 'total', label: t('reportsTotal'), value: number(report.reports.total) },
        { key: 'anonymous', label: t('reportsAnonymous'), value: number(report.reports.anonymous) },
      ])}
      {table('by-reason', t('byReason'), byReason)}
      {table('by-target', t('byTarget'), byTarget)}
      {table('cases', t('cases'), [
        { key: 'opened', label: t('casesOpened'), value: number(report.cases.opened) },
        { key: 'signals', label: t('casesFromSignals'), value: number(report.cases.fromSignals) },
        { key: 'resolved', label: t('casesResolved'), value: number(report.cases.resolved) },
        {
          key: 'median',
          label: t('medianHours'),
          value:
            report.cases.medianResolutionHours === null
              ? t('noMedian')
              : t('hours', {
                  count: format.number(report.cases.medianResolutionHours, {
                    maximumFractionDigits: 1,
                  }),
                }),
        },
      ])}
      {table('by-kind', t('byKind'), byKind)}
      {table('appeals', t('appealsAndSuspensions'), [
        { key: 'started', label: t('suspensions'), value: number(report.suspensions.started) },
        {
          key: 'permanent',
          label: t('suspensionsPermanent'),
          value: number(report.suspensions.permanent),
        },
        { key: 'received', label: t('appealsReceived'), value: number(report.appeals.received) },
        { key: 'upheld', label: t('appealsUpheld'), value: number(report.appeals.upheld) },
        {
          key: 'overturned',
          label: t('appealsOverturned'),
          value: number(report.appeals.overturned),
        },
        { key: 'pending', label: t('appealsPending'), value: number(report.appeals.pending) },
      ])}
    </div>
  );
}
