'use client';

import { projectsControllerDelete, projectsControllerPublish } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Alert,
  AlertDialog,
  Button,
  Callout,
  Checkbox,
  FormActions,
  Heading,
  Link,
  Text,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useAccess, useWithPrerequisites } from '@/features/access';
import { useRouter } from '@/i18n/navigation';
import { missingSteps } from '../../lib/wizard-steps';
import { useProblemText } from '../shared/use-problem-text';
import { useProjectEditor } from './editor-context';

/**
 * Step 10, « Publication » (§11.1, ADR 0040): what the api still needs (the steps to complete,
 * the prerequisites of the account, asked through the mechanism of the prerequisites), the
 * explicit consent to the public display of the name, the photo and the title of the holder and
 * of the team, which applies even when their own profile stays private, then the publication.
 */
export function StepPublish() {
  const t = useTranslations('web.projects.editor.publish');
  const steps = useTranslations('web.projects.editor.steps');
  const { project, setProject } = useProjectEditor();
  const access = useAccess('project.publish');
  const withPrerequisites = useWithPrerequisites();
  const problemText = useProblemText();
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const missing = missingSteps(project);

  async function publish() {
    if (!consent) {
      setConsentError(true);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const published = await withPrerequisites(() =>
        projectsControllerPublish(project.id, { publicDisplayConsent: true }),
      );
      setProject(published);
      router.push(`${routes.project(published.slug)}?published=1`);
    } catch (error) {
      setProblem(problemText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8">
      {missing.length > 0 ? (
        <Alert tone="warning" title={t('missingTitle')}>
          <ul className="mt-1 grid gap-1">
            {missing.map((step) => (
              <li key={step}>
                <Link href={routes.projectEdit(project.slug, step)}>{steps(`${step}.title`)}</Link>
              </li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert tone="success" title={t('readyTitle')}>
          {t('readyBody')}
        </Alert>
      )}
      {!access.pending && !access.allowed && access.reason ? (
        <Callout title={t('prerequisitesTitle')}>{access.reason}</Callout>
      ) : null}
      <section aria-labelledby="consent-title" className="grid gap-3">
        <Heading level={2} size="card" id="consent-title">
          {t('consentTitle')}
        </Heading>
        <Text size="sm">{t('consentBody')}</Text>
        <Checkbox
          label={t('consent')}
          checked={consent}
          aria-invalid={consentError && !consent}
          onCheckedChange={(checked) => {
            setConsent(checked === true);
            setConsentError(false);
          }}
        />
        {consentError && !consent ? (
          <p role="alert" className="text-sm text-danger">
            {t('consentRequired')}
          </p>
        ) : null}
      </section>
      {problem ? (
        <Alert tone="danger" live="alert">
          {problem}
        </Alert>
      ) : null}
      <FormActions>
        <Button
          type="button"
          loading={busy}
          loadingLabel={t('publishing')}
          disabledReason={missing.length > 0 ? t('missingTitle') : undefined}
          onClick={() => void publish()}
        >
          {t('publish')}
        </Button>
        <Button asChild variant="ghost">
          <Link href={routes.projectEdit(project.slug, 'preview')} variant="standalone">
            {t('backToPreview')}
          </Link>
        </Button>
      </FormActions>
      <DeleteDraft />
    </div>
  );
}

/** The deletion of a draft (§11.1), possible at this state only, the title typed to confirm. */
export function DeleteDraft() {
  const t = useTranslations('web.projects.editor.delete');
  const { project } = useProjectEditor();
  const problemText = useProblemText();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  if (project.status !== 'draft' || project.management?.viewerRole !== 'owner') return null;
  return (
    <section
      aria-labelledby="delete-title"
      className="grid gap-3 rounded-xl border border-danger/40 p-5"
    >
      <Heading level={2} size="card" id="delete-title">
        {t('title')}
      </Heading>
      <Text size="sm" tone="muted">
        {t('body')}
      </Text>
      <div>
        <AlertDialog
          trigger={
            <Button type="button" variant="danger">
              {t('action')}
            </Button>
          }
          title={t('confirmTitle', { title: project.title })}
          description={t('confirmBody')}
          confirmLabel={t('confirm')}
          cancelLabel={t('cancel')}
          confirmPhrase={project.title}
          onConfirm={async () => {
            setProblem(null);
            try {
              await projectsControllerDelete(project.id);
              router.push(routes.projects);
            } catch (error) {
              setProblem(problemText(error));
            }
          }}
        />
      </div>
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
