'use client';

import { organizationsControllerCreate } from '@pitchorium/api-client';
import type { CreateOrganizationRequest } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Control } from 'react-hook-form';
import { Button, Form, FormActions, Stepper, useApplyProblem, useZodForm } from '@/components/ui';
import { routes } from '@/config/routes';
import { useWithPrerequisites } from '@/features/access';
import { useRouter } from '@/i18n/navigation';
import { createOrganizationRequest } from '../lib/schemas';
import { orNull } from '../lib/values';
import { OrganizationFields, type OrganizationValues } from './organization-fields';

const STEPS = ['identity', 'presentation'] as const;
const IDENTITY_FIELDS = ['name', 'structureType', 'countryCodes'] as const;

/**
 * Creation of an organisation in two steps (§10.7): who it is (name, type, countries), then how
 * it presents itself, which may wait. A member without a verified email is asked for it by the
 * mechanism of the prerequisites, then the creation runs again; the creator becomes its owner
 * and lands on its management.
 */
export function CreateOrganizationForm() {
  const t = useTranslations('web.organizations.create');
  const router = useRouter();
  const withPrerequisites = useWithPrerequisites();
  const [step, setStep] = useState(0);
  const form = useZodForm(createOrganizationRequest, {
    // The type is chosen in the form: no default among the types.
    defaultValues: { name: '', countryCodes: [] } as Partial<CreateOrganizationRequest>,
  });
  const applyProblem = useApplyProblem(form);

  async function next() {
    if (await form.trigger([...IDENTITY_FIELDS])) setStep(1);
  }

  async function submit(values: CreateOrganizationRequest) {
    try {
      const organization = await withPrerequisites(() =>
        organizationsControllerCreate({
          name: values.name,
          structureType: values.structureType,
          countryCodes: values.countryCodes,
          description: orNull(values.description),
          sectorCodes: values.sectorCodes ?? [],
          websiteUrl: orNull(values.websiteUrl),
          foundedYear: values.foundedYear ?? null,
        }),
      );
      router.push(`${routes.organizationManage(organization.slug)}?created=1`);
    } catch (error) {
      applyProblem(error);
      // A refusal on a field of the first step brings it back into view.
      if (IDENTITY_FIELDS.some((field) => form.getFieldState(field).error)) setStep(0);
    }
  }

  return (
    <div className="grid gap-6">
      <Stepper
        label={t('steps.label')}
        current={step}
        steps={STEPS.map((id) => ({ id, label: t(`steps.${id}`) }))}
      />
      <Form form={form} onSubmit={submit} aria-label={t('title')}>
        {/* The fields of the creation are those of the edition, the first three required. */}
        <OrganizationFields
          control={form.control as unknown as Control<OrganizationValues>}
          step={STEPS[step]}
        />
        <FormActions>
          {step === 0 ? (
            <Button type="button" onClick={() => void next()}>
              {t('next')}
            </Button>
          ) : (
            <>
              <Button
                type="submit"
                loading={form.formState.isSubmitting}
                loadingLabel={t('creating')}
              >
                {t('submit')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                {t('back')}
              </Button>
            </>
          )}
        </FormActions>
      </Form>
    </div>
  );
}
