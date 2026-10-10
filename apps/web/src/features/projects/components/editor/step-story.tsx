'use client';

import { projectsControllerUpdate } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { lazy, Suspense } from 'react';
import { FieldSkeleton, Form, FormField, useApplyProblem, useZodForm } from '@/components/ui';
import { PROJECT_LIMITS } from '../../lib/limits';
import { useProjectEditor } from './editor-context';
import { storySchema } from './schemas';
import { useStepAutosave } from './use-step-form';

/** The editor loads with the step, never in another first load. */
const MarkdownEditor = lazy(() => import('./markdown-editor'));

/** Step 2, « Histoire »: the description in the restricted Markdown of the api (§11.1). */
export function StepStory() {
  const t = useTranslations('web.projects.editor.fields');
  const { project, setProject } = useProjectEditor();
  const form = useZodForm(storySchema, {
    defaultValues: { description: project.description ?? undefined },
  });
  const applyProblem = useApplyProblem(form);
  useStepAutosave(form, async (values) => {
    try {
      setProject(
        await projectsControllerUpdate(project.id, {
          description: values.description?.trim() ? values.description : null,
        }),
      );
    } catch (error) {
      applyProblem(error);
      throw error;
    }
  });
  return (
    <Form form={form} onSubmit={() => undefined} aria-label={t('description')}>
      <FormField
        control={form.control}
        name="description"
        label={t('description')}
        description={t('descriptionHint')}
        maxLength={PROJECT_LIMITS.description}
        render={({ field }) => (
          <Suspense fallback={<FieldSkeleton />}>
            <MarkdownEditor
              name={field.name}
              value={field.value ?? ''}
              onChange={(value) => field.onChange(value === '' ? undefined : value)}
              onBlur={field.onBlur}
            />
          </Suspense>
        )}
      />
    </Form>
  );
}
