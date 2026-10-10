'use client';

import { projectsControllerCreate } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { Button, Form, FormActions, useApplyProblem, useZodForm } from '@/components/ui';
import { routes } from '@/config/routes';
import { useWithPrerequisites } from '@/features/access';
import { useRouter } from '@/i18n/navigation';
import { EssentialsFields, type EssentialsValues } from './essentials-fields';
import { essentialsSchema } from './schemas';

/**
 * Step 1 of a new project (§11.1, ADR 0131): its essentials, then the draft is created by the api
 * (an entrepreneur facet is asked by the mechanism of the prerequisites when it lacks) and the
 * assistant goes on at the address of its next step, the draft saved from then on as it is
 * written.
 */
export function CreateProject() {
  const t = useTranslations('web.projects.editor.create');
  const router = useRouter();
  const withPrerequisites = useWithPrerequisites();
  const form = useZodForm(essentialsSchema, {
    defaultValues: { title: '' } as Partial<EssentialsValues>,
  });
  const applyProblem = useApplyProblem(form);
  async function submit(values: EssentialsValues) {
    try {
      const project = await withPrerequisites(() =>
        projectsControllerCreate({
          title: values.title.trim(),
          ...(values.summary?.trim() ? { summary: values.summary.trim() } : {}),
          ...(values.sectorCode ? { sectorCode: values.sectorCode } : {}),
          ...(values.countryCodes?.length ? { countryCodes: values.countryCodes } : {}),
          ...(values.impactArea?.trim() ? { impactArea: values.impactArea.trim() } : {}),
          ...(values.organizationId ? { organizationId: values.organizationId } : {}),
        }),
      );
      router.push(routes.projectEdit(project.slug, 'story'));
    } catch (error) {
      applyProblem(error);
    }
  }
  return (
    <Form form={form} onSubmit={submit} aria-label={t('title')}>
      <EssentialsFields control={form.control} />
      <FormActions>
        <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('creating')}>
          {t('submit')}
        </Button>
      </FormActions>
    </Form>
  );
}
