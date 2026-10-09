'use client';

import { useProfilesControllerReferenceData } from '@pitchorium/api-client';
import type { UpdateOrganizationRequest } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { Control } from 'react-hook-form';
import { DeferredCombobox, DeferredSelect, FormField, Input, Textarea } from '@/components/ui';
import { countryOptions } from '@/lib/format/countries';

/** The values of the form of an organisation, every field of the edition. */
export type OrganizationValues = UpdateOrganizationRequest;

/**
 * The fields of an organisation (§10.7): name, type of structure, countries, then the optional
 * description, sectors, site and year. Shared by the guided creation and the edition.
 */
export function OrganizationFields({
  control,
  step = 'all',
}: {
  control: Control<OrganizationValues>;
  /** The guided creation shows the identity first, the presentation next. */
  step?: 'identity' | 'presentation' | 'all';
}) {
  const t = useTranslations('web.organizations.fields');
  const reference = useTranslations('reference');
  const locale = useLocale();
  const data = useProfilesControllerReferenceData({ query: { staleTime: Infinity } }).data;
  const options = useMemo(
    () => ({
      // The types of structure of the reference data: the contracts stay off the first load.
      structures: (data?.structureTypes ?? []).map(({ code }) => ({
        value: code,
        label: reference(`structureTypes.${code}` as never),
      })),
      sectors: (data?.sectors ?? []).map(({ code }) => ({
        value: code,
        label: reference(`sectors.${code}` as never),
      })),
      countries: countryOptions(
        (data?.countries ?? []).map(({ code }) => code),
        locale,
      ),
    }),
    [data, reference, locale],
  );
  return (
    <>
      {step !== 'presentation' ? (
        <>
          <FormField
            control={control}
            name="name"
            label={t('name')}
            maxLength={160}
            render={({ field }) => (
              <Input {...field} value={field.value ?? ''} autoComplete="organization" />
            )}
          />
          <FormField
            control={control}
            name="structureType"
            label={t('structureType')}
            render={({ field }) => (
              <DeferredSelect
                options={options.structures}
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
                max={60}
                options={options.countries}
                value={field.value ?? []}
                placeholder={t('countriesPlaceholder')}
                onValueChange={field.onChange}
              />
            )}
          />
        </>
      ) : null}
      {step !== 'identity' ? (
        <>
          <FormField
            control={control}
            name="description"
            label={t('description')}
            description={t('descriptionHint')}
            optional
            maxLength={2600}
            render={({ field }) => <Textarea {...field} value={field.value ?? ''} rows={6} />}
          />
          <FormField
            control={control}
            name="sectorCodes"
            label={t('sectors')}
            optional
            render={({ field }) => (
              <DeferredCombobox
                multiple
                max={21}
                options={options.sectors}
                value={field.value ?? []}
                placeholder={t('sectorsPlaceholder')}
                onValueChange={field.onChange}
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <FormField
              control={control}
              name="websiteUrl"
              label={t('website')}
              description={t('websiteHint')}
              optional
              render={({ field }) => (
                <Input {...field} value={field.value ?? ''} type="url" autoComplete="url" />
              )}
            />
            <FormField
              control={control}
              name="foundedYear"
              label={t('foundedYear')}
              optional
              render={({ field }) => (
                <Input
                  {...field}
                  value={field.value ?? ''}
                  inputMode="numeric"
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '');
                    field.onChange(digits === '' ? null : Number(digits));
                  }}
                />
              )}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
