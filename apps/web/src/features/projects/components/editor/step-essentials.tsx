'use client';

import { projectsControllerUpdate } from '@pitchorium/api-client';
import { Form, useApplyProblem, useZodForm } from '@/components/ui';
import { useProjectEditor } from './editor-context';
import { EssentialsFields, type EssentialsValues } from './essentials-fields';
import { essentialsSchema } from './schemas';
import { useStepAutosave } from './use-step-form';

/** A value left empty is cleared (`null`): the api refuses an empty text. */
const orNull = (value: string | undefined) => (value?.trim() ? value.trim() : null);

/** Step 1, « Essentiel », saved as it is written (ADR 0131). */
export function StepEssentials() {
  const { project, setProject } = useProjectEditor();
  const form = useZodForm(essentialsSchema, {
    defaultValues: {
      title: project.title,
      summary: project.summary ?? undefined,
      sectorCode: project.sectorCode ?? undefined,
      countryCodes: project.countryCodes.length > 0 ? project.countryCodes : undefined,
      impactArea: project.impactArea ?? undefined,
      organizationId: project.organization?.id,
    },
  });
  const applyProblem = useApplyProblem(form);
  useStepAutosave(form, async (values) => {
    try {
      setProject(
        await projectsControllerUpdate(project.id, {
          title: values.title.trim(),
          summary: orNull(values.summary),
          sectorCode: values.sectorCode ?? null,
          ...(values.countryCodes?.length ? { countryCodes: values.countryCodes } : {}),
          impactArea: orNull(values.impactArea),
          organizationId: values.organizationId ?? null,
        }),
      );
    } catch (error) {
      applyProblem(error);
      throw error;
    }
  });
  return (
    <Form form={form} onSubmit={() => undefined} aria-label={project.title}>
      <EssentialsFields control={form.control} />
    </Form>
  );
}

export type { EssentialsValues };
