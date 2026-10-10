import type { ImpactMethodology } from '@pitchorium/contracts';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert, Card, Heading, Notice, Text } from '@/components/ui';
import { labelOf, type ReferenceLabels } from '../lib/labels';

/**
 * The methodology of the self-declared impact in force (§12, ADR 0036): its criteria, their scale
 * and their weight, its version, the levels, and the mention that the impact is declared by the
 * holder and never certified. Labels are translated from the keys the api gives.
 */
export async function MethodologyPage({ methodology }: { methodology: ImpactMethodology }) {
  const t = await getTranslations('web.impact.methodology');
  const levels = await getTranslations('reference.impactLevels');
  const reference = (await getTranslations('reference')) as unknown as ReferenceLabels;
  const format = await getFormatter();
  const total = methodology.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  return (
    <div className="grid gap-10">
      <div className="grid gap-3">
        <Text tone="muted">
          {t('version', {
            name: methodology.name,
            version: methodology.version,
            date: methodology.publishedAt
              ? format.dateTime(new Date(methodology.publishedAt), { dateStyle: 'long' })
              : '',
          })}
        </Text>
        {methodology.demo ? <Alert tone="warning">{reference('impactMentions.demo')}</Alert> : null}
        <Notice kind="selfDeclared" version={`v${methodology.version}`} />
        <Text className="max-w-prose">{t('notCertified')}</Text>
      </div>
      <section aria-labelledby="criteria-title" className="grid gap-4">
        <Heading level={2} size="section" id="criteria-title">
          {t('criteria', { count: methodology.criteria.length })}
        </Heading>
        <ol className="grid gap-4">
          {methodology.criteria.map((criterion, index) => (
            <li key={criterion.key}>
              <Card className="grid gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Heading level={3} size="card">
                    {t('criterion', {
                      index: index + 1,
                      label: labelOf(reference, criterion.labelKey),
                    })}
                  </Heading>
                  <span className="text-sm text-muted tabular-nums">
                    {t('weight', {
                      percent: format.number(total === 0 ? 0 : criterion.weight / total, {
                        style: 'percent',
                        maximumFractionDigits: 0,
                      }),
                    })}
                  </span>
                </div>
                <Text size="sm">{labelOf(reference, criterion.descriptionKey)}</Text>
                <div className="grid gap-1">
                  <p className="text-sm font-medium">{t('scale')}</p>
                  <ul className="flex flex-wrap gap-2 text-sm">
                    {criterion.scale.map((level) => (
                      <li
                        key={level.key}
                        className="rounded-full border border-border px-3 py-1 tabular-nums"
                      >
                        {labelOf(reference, level.labelKey)}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="levels-title" className="grid gap-3">
        <Heading level={2} size="section" id="levels-title">
          {t('levels')}
        </Heading>
        <Text className="max-w-prose">{t('score')}</Text>
        <ul className="grid gap-2 text-sm">
          <li>{t('emerging', { level: levels('emerging') })}</li>
          <li>{t('moderate', { level: levels('moderate') })}</li>
          <li>{t('strong', { level: levels('strong') })}</li>
        </ul>
      </section>
    </div>
  );
}
