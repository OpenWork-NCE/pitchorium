'use client';

import { AlertCircle, Check, CloudUpload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button, Heading } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { neighbours, stepComplete, type WizardStep, WIZARD_STEPS } from '../../lib/wizard-steps';
import { useProjectEditor } from './editor-context';

/** Steps of a published project: its texts and its parts, never its publication again. */
const PUBLISHED_STEPS: readonly WizardStep[] = WIZARD_STEPS.filter(
  (step) => step !== 'preview' && step !== 'publish',
);

/** The indicator of the saving of the draft (ADR 0131), announced politely. */
function SaveIndicator() {
  const t = useTranslations('web.projects.editor.save');
  const { save } = useProjectEditor();
  const icon =
    save === 'saving' ? (
      <CloudUpload aria-hidden className="size-4" />
    ) : save === 'error' ? (
      <AlertCircle aria-hidden className="size-4 text-danger" />
    ) : save === 'saved' ? (
      <Check aria-hidden className="size-4 text-success" />
    ) : null;
  return (
    <p role="status" className="flex min-h-5 items-center gap-1.5 text-sm text-muted">
      {icon}
      {save === 'idle' ? null : t(save)}
    </p>
  );
}

/**
 * The frame of the assistant of a project (§11.1, ADR 0131): its steps, each at its own address,
 * done or still to complete, the indicator « Enregistré », the step itself, then « Précédent »
 * and « Suivant », which save what is pending before leaving.
 */
export function WizardShell({ step, children }: { step: WizardStep; children: ReactNode }) {
  const t = useTranslations('web.projects.editor');
  const { project, flush } = useProjectEditor();
  const router = useRouter();
  const published = project.status !== 'draft';
  const steps: readonly WizardStep[] = published ? PUBLISHED_STEPS : WIZARD_STEPS;
  const index = steps.indexOf(step);
  const around = neighbours(step);
  const previous = around.previous && steps.includes(around.previous) ? around.previous : null;
  const next = around.next && steps.includes(around.next) ? around.next : null;
  const go = async (target: WizardStep) => {
    await flush();
    router.push(routes.projectEdit(project.slug, target));
  };
  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <p className="text-sm text-muted">
          {published ? t('editing', { title: project.title }) : t('creating')}
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Heading level={1} size="page">
            {t(`steps.${step}.title`)}
          </Heading>
          <SaveIndicator />
        </div>
        <p className="max-w-prose text-muted">{t(`steps.${step}.description`)}</p>
      </header>
      <nav aria-label={t('stepsLabel')} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <p className="mb-2 text-sm text-muted sm:sr-only">
          {t('position', { current: index + 1, total: steps.length })}
        </p>
        <ol className="flex min-w-max gap-2">
          {steps.map((item, position) => {
            const current = item === step;
            const done = !current && stepComplete(item, project) && position < index;
            return (
              <li key={item}>
                <Link
                  href={routes.projectEdit(project.slug, item)}
                  aria-current={current ? 'step' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    if (!current) void go(item);
                  }}
                  className={cn(
                    'flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    current
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-border bg-surface text-foreground hover:border-border-strong',
                  )}
                >
                  <span className="tabular-nums">{position + 1}</span>
                  {t(`steps.${item}.short`)}
                  {done ? (
                    <>
                      <Check aria-hidden className="size-4 text-success" />
                      <span className="sr-only">{t('done')}</span>
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      <div>{children}</div>
      <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-6">
        {previous ? (
          <Button type="button" variant="ghost" onClick={() => void go(previous)}>
            {t('previous')}
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button type="button" variant="secondary" onClick={() => void go(next)}>
            {t('next', { step: t(`steps.${next}.short`) })}
          </Button>
        ) : published ? (
          <Button asChild variant="secondary">
            <Link href={routes.project(project.slug)}>{t('backToPage')}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
