'use client';

import {
  useOrganizationsControllerMine,
  useProfilesControllerReferenceData,
} from '@pitchorium/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { Control } from 'react-hook-form';
import { DeferredCombobox, DeferredSelect, FormField, Input, Textarea } from '@/components/ui';
import { countryOptions } from '@/lib/format/countries';
import { PROJECT_LIMITS } from '../../lib/limits';

/** The essentials of a project (§11.1): what the first step of the assistant writes. */
export interface EssentialsValues {
  title: string;
  summary?: string;
  sectorCode?: string;
  countryCodes?: string[];
  impactArea?: string;
  organizationId?: string;
}

const NONE = 'none';

/**
 * Fields of the first step: title, summary, sector (short labels), countries of Africa and of the
 * Caribbean only (`eligibleForCompany` of the reference data, the api deciding), area of impact,
 * and the carrying organisation among those where the member is `owner` or `admin`.
 */
export function EssentialsFields({ control }: { control: Control<EssentialsValues> }) {
  const t = useTranslations('web.projects.editor.fields');
  const reference = useTranslations('reference') as unknown as {
    (key: string): string;
    has: (key: string) => boolean;
  };
  const locale = useLocale();
  const data = useProfilesControllerReferenceData({ query: { staleTime: Infinity } }).data;
  const mine = useOrganizationsControllerMine({ query: { staleTime: 60_000 } }).data;
  const options = useMemo(
    () => ({
      sectors: (data?.sectors ?? []).map(({ code }) => ({
        value: code,
        label: reference.has(`sectorsShort.${code}`)
          ? reference(`sectorsShort.${code}`)
          : reference(`sectors.${code}`),
      })),
      countries: countryOptions(
        (data?.countries ?? []).filter((country) => country.eligibleForCompany).map((c) => c.code),
        locale,
      ),
      organizations: (mine?.items ?? [])
        .filter((organization) => organization.role === 'owner' || organization.role === 'admin')
        .map((organization) => ({ value: organization.id, label: organization.name })),
    }),
    [data, mine, reference, locale],
  );
  return (
    <>
      <FormField
        control={control}
        name="title"
        label={t('title')}
        maxLength={PROJECT_LIMITS.title}
        render={({ field }) => <Input {...field} value={field.value ?? ''} autoComplete="off" />}
      />
      <FormField
        control={control}
        name="summary"
        label={t('summary')}
        description={t('summaryHint')}
        maxLength={PROJECT_LIMITS.summary}
        render={({ field }) => (
          <Textarea
            {...field}
            value={field.value ?? ''}
            onChange={(event) => field.onChange(event.target.value || undefined)}
            rows={3}
          />
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="sectorCode"
          label={t('sector')}
          render={({ field }) => (
            <DeferredSelect
              options={options.sectors}
              value={field.value}
              placeholder={t('choose')}
              onValueChange={field.onChange}
            />
          )}
        />
        <FormField
          control={control}
          name="countryCodes"
          label={t('countries')}
          description={t('countriesHint')}
          render={({ field }) => (
            <DeferredCombobox
              multiple
              max={PROJECT_LIMITS.countries}
              options={options.countries}
              value={field.value ?? []}
              placeholder={t('countriesPlaceholder')}
              // No country chosen yet is an absent value, not an empty list (refused).
              onValueChange={(value) => field.onChange(value.length > 0 ? value : undefined)}
            />
          )}
        />
      </div>
      <FormField
        control={control}
        name="impactArea"
        label={t('impactArea')}
        description={t('impactAreaHint')}
        maxLength={PROJECT_LIMITS.impactArea}
        render={({ field }) => (
          <Input
            {...field}
            value={field.value ?? ''}
            onChange={(event) => field.onChange(event.target.value || undefined)}
            autoComplete="off"
          />
        )}
      />
      {options.organizations.length > 0 ? (
        <FormField
          control={control}
          name="organizationId"
          label={t('organization')}
          description={t('organizationHint')}
          optional
          render={({ field }) => (
            <DeferredSelect
              options={[{ value: NONE, label: t('noOrganization') }, ...options.organizations]}
              value={field.value ?? NONE}
              onValueChange={(value) => field.onChange(value === NONE ? undefined : value)}
            />
          )}
        />
      ) : null}
    </>
  );
}
