'use client';

import { useTranslations } from 'next-intl';
import { lazy, Suspense } from 'react';
import { FieldSkeleton, Loading } from '@/components/ui';

/** The form, its controls and its validation load after the page (ADR 0094). */
const CreateOrganizationForm = lazy(() =>
  import('./create-organization-form').then((module) => ({
    default: module.CreateOrganizationForm,
  })),
);

/** The creation of an organisation in two steps (§10.7), its fields drawn while they load. */
export function CreateOrganization() {
  const t = useTranslations('web.organizations.fields');
  return (
    <Suspense
      fallback={
        <Loading className="grid gap-5">
          {(['name', 'structureType', 'countries'] as const).map((field) => (
            <div key={field} className="grid gap-1.5">
              <span className="text-sm font-medium">{t(field)}</span>
              <FieldSkeleton />
            </div>
          ))}
        </Loading>
      }
    >
      <CreateOrganizationForm />
    </Suspense>
  );
}
