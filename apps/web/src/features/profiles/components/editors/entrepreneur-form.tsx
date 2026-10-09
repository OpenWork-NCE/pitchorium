'use client';

import {
  meControllerCreateEntrepreneurFacet,
  meControllerDeleteEntrepreneurFacet,
  meControllerUpdateEntrepreneurFacet,
  useProfilesControllerReferenceData,
} from '@pitchorium/api-client';
import {
  BIO_MAX_LENGTH,
  type CreateEntrepreneurFacetRequest,
  createEntrepreneurFacetRequestSchema,
  ENTREPRENEUR_NEEDS,
  type EntrepreneurFacet,
} from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  AlertDialog,
  Button,
  Combobox,
  Field,
  Form,
  FormActions,
  FormField,
  Input,
  MoneyInput,
  Select,
  Textarea,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { countryOptions } from '@/lib/format/countries';
import { currencyOptions } from '../../lib/options';
import { orNull } from './editor-dialog';
import { TagsInput } from './tags-input';

type Values = CreateEntrepreneurFacetRequest;

/** A whole number typed in a field, or null when it is empty or not a number. */
const wholeOrNull = (text: string): number | null =>
  text.trim() === '' || Number.isNaN(Number(text)) ? null : Math.trunc(Number(text));

/**
 * The entrepreneur facet (§10.1): company, sector, stage and country of the company (the minimal
 * facet, ADR 0016), then city, team, year, pitch, needs, sought expertise and funding target.
 * Created, changed or removed after a confirmation. Its labels come from the reference data
 * (sectors, stages), the countries of a company from Africa and the Caribbean only.
 */
export function EntrepreneurForm({
  facet,
  onSaved,
  onCancel,
}: {
  /** The facet to change; null creates it. */
  facet: EntrepreneurFacet | null;
  onSaved: () => void;
  /** Absent in the dialog of a prerequisite, which has its own « Plus tard ». */
  onCancel?: () => void;
}) {
  const t = useTranslations('web.profile.edit');
  const reference = useTranslations('reference');
  const locale = useLocale();
  const data = useProfilesControllerReferenceData({ query: { staleTime: Infinity } }).data;
  const options = useMemo(
    () => ({
      sectors: (data?.sectors ?? []).map(({ code }) => ({
        value: code,
        label: reference(`sectors.${code}` as never),
      })),
      stages: (data?.stages ?? []).map(({ code }) => ({
        value: code,
        label: reference(`stages.${code}` as never),
      })),
      countries: countryOptions(
        (data?.countries ?? [])
          .filter((country) => country.eligibleForCompany)
          .map(({ code }) => code),
        locale,
      ),
      needs: ENTREPRENEUR_NEEDS.map((code) => ({
        value: code,
        label: reference(`entrepreneurNeeds.${code}`),
      })),
      currencies: currencyOptions(locale),
    }),
    [data, reference, locale],
  );
  const form = useZodForm(createEntrepreneurFacetRequestSchema, {
    defaultValues: (facet ?? {
      companyName: '',
      sectorCode: '',
      stageCode: '',
      companyCountryCode: '',
      needs: [],
      soughtExpertise: [],
    }) as unknown as Values,
  });
  const applyProblem = useApplyProblem(form);
  const [currency, setCurrency] = useState(facet?.fundingTarget?.currency ?? 'EUR');

  async function submit(values: Values) {
    const body = {
      ...values,
      companyCity: orNull(values.companyCity),
      pitch: orNull(values.pitch),
      fundingTarget: values.fundingTarget ?? null,
    };
    try {
      if (facet) await meControllerUpdateEntrepreneurFacet(body);
      else await meControllerCreateEntrepreneurFacet(body);
    } catch (error) {
      applyProblem(error);
      return;
    }
    onSaved();
  }

  return (
    <Form form={form} onSubmit={submit} aria-label={t('entrepreneur.title')}>
      <FormField
        control={form.control}
        name="companyName"
        label={t('fields.companyName')}
        render={({ field }) => <Input {...field} autoComplete="organization" />}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="sectorCode"
          label={t('fields.sector')}
          render={({ field }) => (
            <Combobox
              options={options.sectors}
              value={field.value || null}
              placeholder={t('fields.choose')}
              onValueChange={(code) => field.onChange(code ?? '')}
            />
          )}
        />
        <FormField
          control={form.control}
          name="stageCode"
          label={t('fields.stage')}
          render={({ field }) => (
            <Select
              options={options.stages}
              value={field.value || undefined}
              placeholder={t('fields.choose')}
              onValueChange={(code) => field.onChange(code)}
            />
          )}
        />
        <FormField
          control={form.control}
          name="companyCountryCode"
          label={t('fields.companyCountry')}
          description={t('fields.companyCountryHint')}
          render={({ field }) => (
            <Combobox
              options={options.countries}
              value={field.value || null}
              placeholder={t('fields.countryPlaceholder')}
              onValueChange={(code) => field.onChange(code ?? '')}
            />
          )}
        />
        <FormField
          control={form.control}
          name="companyCity"
          label={t('fields.city')}
          optional
          render={({ field }) => <Input {...field} value={field.value ?? ''} />}
        />
        <FormField
          control={form.control}
          name="teamSize"
          label={t('fields.teamSize')}
          optional
          render={({ field }) => (
            <Input
              {...field}
              inputMode="numeric"
              value={field.value ?? ''}
              onChange={(event) => field.onChange(wholeOrNull(event.target.value))}
            />
          )}
        />
        <FormField
          control={form.control}
          name="foundedYear"
          label={t('fields.foundedYear')}
          optional
          render={({ field }) => (
            <Input
              {...field}
              inputMode="numeric"
              value={field.value ?? ''}
              onChange={(event) => field.onChange(wholeOrNull(event.target.value))}
            />
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="pitch"
        label={t('fields.pitch')}
        description={t('fields.pitchHint')}
        optional
        maxLength={BIO_MAX_LENGTH}
        render={({ field }) => <Textarea {...field} value={field.value ?? ''} rows={5} />}
      />
      <FormField
        control={form.control}
        name="needs"
        label={t('fields.needs')}
        optional
        render={({ field }) => (
          <Combobox
            multiple
            options={options.needs}
            value={field.value ?? []}
            placeholder={t('fields.choose')}
            onValueChange={(codes) => field.onChange(codes)}
          />
        )}
      />
      <FormField
        control={form.control}
        name="soughtExpertise"
        label={t('fields.soughtExpertise')}
        description={t('fields.soughtExpertiseHint')}
        optional
        render={({ field }) => (
          <TagsInput
            value={field.value ?? []}
            onChange={field.onChange}
            max={20}
            maxLength={80}
            placeholder={t('fields.soughtExpertisePlaceholder')}
          />
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="fundingTarget"
          label={t('fields.fundingTarget')}
          optional
          render={({ field }) => (
            <MoneyInput
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value?.amountMinor ?? null}
              currency={currency}
              onChange={(minor) => field.onChange(minor ? { amountMinor: minor, currency } : null)}
            />
          )}
        />
        <Field label={t('fields.currency')}>
          <Combobox
            options={options.currencies}
            value={currency}
            onValueChange={(code) => {
              const next = code ?? 'EUR';
              setCurrency(next);
              const amount = form.getValues('fundingTarget');
              if (amount)
                form.setValue(
                  'fundingTarget',
                  { ...amount, currency: next },
                  { shouldDirty: true },
                );
            }}
          />
        </Field>
      </div>
      <FormActions>
        <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('saving')}>
          {facet ? t('save') : t('entrepreneur.create')}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('cancel')}
          </Button>
        ) : null}
        {facet ? (
          <AlertDialog
            trigger={
              <Button type="button" variant="link" className="text-danger sm:mr-auto">
                {t('entrepreneur.delete')}
              </Button>
            }
            title={t('entrepreneur.deleteTitle')}
            description={t('entrepreneur.deleteDescription')}
            confirmLabel={t('entrepreneur.delete')}
            onConfirm={async () => {
              await meControllerDeleteEntrepreneurFacet();
              onSaved();
            }}
          />
        ) : null}
      </FormActions>
    </Form>
  );
}
