'use client';

import {
  ApiProblemError,
  getMyAssessmentsControllerHistoryQueryKey,
  methodologiesControllerPublished,
  myAssessmentsControllerSubmit,
  useMyAssessmentsControllerHistory,
} from '@pitchorium/api-client';
import type { ImpactAssessment, ImpactMethodology } from '@pitchorium/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge, Card, ErrorState, Heading, Loading, Skeleton, useAnnounce } from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import { AssessmentForm } from './assessment-form';
import { MethodologyUnavailable } from './methodology-unavailable';

type Methodology =
  | { state: 'loading' }
  | { state: 'unavailable' }
  | { state: 'failed' }
  | { state: 'ready'; methodology: ImpactMethodology };

const answersOf = (assessment: ImpactAssessment | undefined, methodology: ImpactMethodology) =>
  assessment && assessment.methodology.id === methodology.id
    ? Object.fromEntries(
        assessment.details.map((detail) => [detail.criterionKey, detail.answerKey]),
      )
    : {};

/**
 * The self-declared impact of the entrepreneur facet of the member (§12): the assessment in
 * force and the form to give or adjust it, a reassessment proposed when the version of the
 * methodology changes, and the history, the newest first. Without an entrepreneur facet, the
 * mechanism of the prerequisites asks for it, then the assessment is sent.
 */
export function EntrepreneurAssessment() {
  const t = useTranslations('web.impact.entrepreneur');
  const levels = useTranslations('reference.impactLevels');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const withPrerequisites = useWithPrerequisites();
  const history = useMyAssessmentsControllerHistory({ query: { retry: false } });
  const [loaded, setLoaded] = useState<Methodology>({ state: 'loading' });
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    methodologiesControllerPublished().then(
      (methodology) => live && setLoaded({ state: 'ready', methodology }),
      (error: unknown) =>
        live &&
        setLoaded(
          error instanceof ApiProblemError &&
            error.problem.code === 'IMPACT_METHODOLOGY_UNAVAILABLE'
            ? { state: 'unavailable' }
            : { state: 'failed' },
        ),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  if (loaded.state === 'loading' || (loaded.state === 'ready' && history.isPending)) {
    return (
      <Loading className="grid gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </Loading>
    );
  }
  if (loaded.state === 'unavailable') return <MethodologyUnavailable />;
  if (loaded.state === 'failed') {
    return <ErrorState title={t('failed')} onRetry={() => setAttempt((count) => count + 1)} />;
  }
  const items = history.data?.items ?? [];
  const current = items[0];
  return (
    <div className="grid gap-10">
      <AssessmentForm
        key={current?.id ?? 'none'}
        methodology={loaded.methodology}
        initialAnswers={answersOf(current, loaded.methodology)}
        current={current ?? null}
        submitLabel={current ? t('update') : t('submit')}
        problem={problem}
        onSubmit={async (answers) => {
          setProblem(null);
          try {
            await withPrerequisites(() =>
              myAssessmentsControllerSubmit({ methodologyId: loaded.methodology.id, answers }),
            );
            announce(t('saved'));
            await queryClient.invalidateQueries({
              queryKey: getMyAssessmentsControllerHistoryQueryKey(),
            });
          } catch (error) {
            setProblem(
              error instanceof ApiProblemError
                ? errors(error.problem.code as never)
                : errors('INTERNAL_ERROR'),
            );
          }
        }}
      />
      <section aria-labelledby="history-title" className="grid gap-4">
        <Heading level={2} size="card" id="history-title">
          {t('history')}
        </Heading>
        {items.length === 0 ? (
          <p className="text-sm text-muted">{t('noHistory')}</p>
        ) : (
          <ol className="grid gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <Card
                  padding="sm"
                  className="flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <span>
                    {format.dateTime(new Date(item.submittedAt), { dateStyle: 'long' })}
                    <span aria-hidden> · </span>
                    {t('version', { version: item.methodology.version })}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">
                      {t('score', { score: item.score, level: levels(item.level) })}
                    </span>
                    {item.source === 'prefilled' ? <Badge>{t('prefilled')}</Badge> : null}
                  </span>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
