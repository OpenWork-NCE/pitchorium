'use client';

import {
  ApiProblemError,
  methodologiesControllerPublished,
  projectImpactControllerPrefill,
  projectImpactControllerSubmit,
} from '@pitchorium/api-client';
import type { ImpactMethodology } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ErrorState, Loading, Skeleton } from '@/components/ui';
import { AssessmentForm, MethodologyUnavailable } from '@/features/impact';
import { useProblemText } from '../shared/use-problem-text';
import { useProjectEditor } from './editor-context';

type Loaded =
  | { state: 'loading' }
  | { state: 'unavailable' }
  | { state: 'failed' }
  | { state: 'ready'; methodology: ImpactMethodology; answers: Record<string, string> };

/**
 * Step 7, « Impact » (§11.1, §12): the self-declared assessment of the project, prefilled from
 * the entrepreneur facet of its holder and adjustable criterion by criterion, with the
 * methodology and its version; a clear state when none is published.
 */
export function StepImpact() {
  const t = useTranslations('web.projects.editor.impact');
  const problemText = useProblemText();
  const { project, refresh, setSave } = useProjectEditor();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const methodology = await methodologiesControllerPublished();
        const prefill = await projectImpactControllerPrefill(project.id).catch(() => null);
        // The assessment in force first, then what the facet of the holder still answers.
        const current = project.impactAssessment;
        const answers =
          current && current.methodology.id === methodology.id
            ? Object.fromEntries(
                current.details.map((detail) => [detail.criterionKey, detail.answerKey]),
              )
            : prefill?.methodologyId === methodology.id
              ? prefill.answers
              : {};
        if (live) setLoaded({ state: 'ready', methodology, answers });
      } catch (error) {
        if (!live) return;
        setLoaded(
          error instanceof ApiProblemError &&
            error.problem.code === 'IMPACT_METHODOLOGY_UNAVAILABLE'
            ? { state: 'unavailable' }
            : { state: 'failed' },
        );
      }
    })();
    return () => {
      live = false;
    };
  }, [project.id, project.impactAssessment, attempt]);
  if (loaded.state === 'loading') {
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
  return (
    <AssessmentForm
      methodology={loaded.methodology}
      initialAnswers={loaded.answers}
      current={project.impactAssessment}
      submitLabel={project.impactAssessment ? t('update') : t('submit')}
      problem={problem}
      onSubmit={async (answers) => {
        setProblem(null);
        setSave('saving');
        try {
          await projectImpactControllerSubmit(project.id, {
            methodologyId: loaded.methodology.id,
            answers,
          });
          await refresh();
          setSave('saved');
        } catch (error) {
          setSave('error');
          setProblem(problemText(error));
        }
      }}
    />
  );
}
