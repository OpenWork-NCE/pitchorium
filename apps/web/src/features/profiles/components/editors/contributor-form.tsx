'use client';

import {
  meControllerCreateContributorFacet,
  meControllerDeleteContributorFacet,
  meControllerUpdateContributorFacet,
  useOrganizationsControllerMine,
  useProfilesControllerReferenceData,
} from '@pitchorium/api-client';
import {
  CONTRIBUTOR_HATS,
  type ContributorFacet,
  type CreateContributorFacetRequest,
  createContributorFacetRequestSchema,
  FUNDING_INSTRUMENTS,
  PATRONAGE_TYPES,
  STRUCTURE_TYPES,
} from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import {
  AlertDialog,
  Button,
  Checkbox,
  Combobox,
  Field,
  Form,
  FormActions,
  FormField,
  Input,
  MoneyInput,
  Select,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { countryOptions } from '@/lib/format/countries';
import { currencyOptions } from '../../lib/options';
import { orNull } from './editor-dialog';

/** Value of the organisation field when the organisation is not on Pitchorium. */
const ELSEWHERE = 'elsewhere';

type Values = CreateContributorFacetRequest;

/**
 * The contributor facet (§5, §10.1): hats and type of structure (the minimal facet, ADR 0016),
 * the organisation (one of the member on Pitchorium, linked, or another named in free text),
 * countries of intervention, sectors, ticket, instruments, kinds of patronage, mentoring and
 * missions. Created, changed or removed after a confirmation.
 */
export function ContributorForm({
  facet,
  onSaved,
  onCancel,
}: {
  facet: ContributorFacet | null;
  onSaved: () => void;
  /** Absent in the dialog of a prerequisite, which has its own « Plus tard ». */
  onCancel?: () => void;
}) {
  const t = useTranslations('web.profile.edit');
  const reference = useTranslations('reference');
  const locale = useLocale();
  const data = useProfilesControllerReferenceData({ query: { staleTime: Infinity } }).data;
  const mine = useOrganizationsControllerMine({ query: { staleTime: 60_000 } }).data?.items ?? [];
  const options = useMemo(
    () => ({
      hats: CONTRIBUTOR_HATS.map((code) => ({
        value: code,
        label: reference(`contributorHats.${code}`),
      })),
      structures: STRUCTURE_TYPES.map((code) => ({
        value: code,
        label: reference(`structureTypes.${code}`),
      })),
      instruments: FUNDING_INSTRUMENTS.map((code) => ({
        value: code,
        label: reference(`fundingInstruments.${code}`),
      })),
      patronage: PATRONAGE_TYPES.map((code) => ({
        value: code,
        label: reference(`patronageTypes.${code}`),
      })),
      sectors: (data?.sectors ?? []).map(({ code }) => ({
        value: code,
        label: reference(`sectors.${code}` as never),
      })),
      countries: countryOptions(
        (data?.countries ?? []).map(({ code }) => code),
        locale,
      ),
      currencies: currencyOptions(locale),
    }),
    [data, reference, locale],
  );
  const form = useZodForm(createContributorFacetRequestSchema, {
    defaultValues: (facet ?? {
      hats: [],
      structureType: '',
      interventionCountryCodes: [],
      sectorCodes: [],
      acceptedInstruments: [],
      patronageTypes: [],
      mentoringAvailable: false,
      openToExpertMissions: false,
    }) as unknown as Values,
  });
  const applyProblem = useApplyProblem(form);
  const [currency, setCurrency] = useState(facet?.ticket?.currency ?? 'EUR');
  const [elsewhere, setElsewhere] = useState(
    Boolean(facet?.organizationName) && !facet?.organizationId,
  );
  // Read by subscription: the compiled component renders again on each change.
  const ticket = useWatch({ control: form.control, name: 'ticket' });
  const mentoring = useWatch({ control: form.control, name: 'mentoringAvailable' });
  const missions = useWatch({ control: form.control, name: 'openToExpertMissions' });

  /** The ticket from its two bounds, null while either is missing. */
  function setTicket(bound: 'minAmountMinor' | 'maxAmountMinor', minor: string | null) {
    const current = form.getValues('ticket');
    const next = {
      minAmountMinor: current?.minAmountMinor ?? '',
      maxAmountMinor: current?.maxAmountMinor ?? '',
      currency,
      [bound]: minor ?? '',
    };
    form.setValue(
      'ticket',
      next.minAmountMinor === '' && next.maxAmountMinor === '' ? null : next,
      { shouldDirty: true },
    );
  }

  async function submit(values: Values) {
    const body = {
      ...values,
      organizationId: elsewhere ? null : (values.organizationId ?? null),
      organizationName: elsewhere ? orNull(values.organizationName) : null,
      ticket: values.ticket ?? null,
    };
    try {
      if (facet) await meControllerUpdateContributorFacet(body);
      else await meControllerCreateContributorFacet(body);
    } catch (error) {
      applyProblem(error);
      return;
    }
    onSaved();
  }

  return (
    <Form form={form} onSubmit={submit} aria-label={t('contributor.title')}>
      <FormField
        control={form.control}
        name="hats"
        label={t('fields.hats')}
        description={t('fields.hatsHint')}
        render={({ field }) => (
          <Combobox
            multiple
            options={options.hats}
            value={field.value ?? []}
            placeholder={t('fields.choose')}
            onValueChange={(codes) => field.onChange(codes)}
          />
        )}
      />
      <FormField
        control={form.control}
        name="structureType"
        label={t('fields.structure')}
        render={({ field }) => (
          <Select
            options={options.structures}
            value={field.value || undefined}
            placeholder={t('fields.choose')}
            onValueChange={(code) => field.onChange(code)}
          />
        )}
      />
      <FormField
        control={form.control}
        name="organizationId"
        label={t('fields.organization')}
        description={t('fields.organizationHint')}
        optional
        render={({ field }) => (
          <Select
            options={[
              ...mine.map((organization) => ({ value: organization.id, label: organization.name })),
              { value: ELSEWHERE, label: t('fields.organizationElsewhere') },
            ]}
            value={elsewhere ? ELSEWHERE : (field.value ?? undefined)}
            placeholder={t('fields.organizationNone')}
            onValueChange={(value) => {
              setElsewhere(value === ELSEWHERE);
              field.onChange(value === ELSEWHERE ? null : value);
            }}
          />
        )}
      />
      {elsewhere ? (
        <FormField
          control={form.control}
          name="organizationName"
          label={t('fields.organizationName')}
          render={({ field }) => (
            <Input {...field} value={field.value ?? ''} autoComplete="organization" />
          )}
        />
      ) : null}
      <FormField
        control={form.control}
        name="interventionCountryCodes"
        label={t('fields.interventionCountries')}
        optional
        render={({ field }) => (
          <Combobox
            multiple
            options={options.countries}
            value={field.value ?? []}
            placeholder={t('fields.countryPlaceholder')}
            onValueChange={(codes) => field.onChange(codes)}
          />
        )}
      />
      <FormField
        control={form.control}
        name="sectorCodes"
        label={t('fields.sectors')}
        optional
        render={({ field }) => (
          <Combobox
            multiple
            options={options.sectors}
            value={field.value ?? []}
            placeholder={t('fields.choose')}
            onValueChange={(codes) => field.onChange(codes)}
          />
        )}
      />
      <FormField
        control={form.control}
        name="ticket"
        label={t('fields.ticket')}
        description={t('fields.ticketHint')}
        optional
        render={() => (
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyInput
              aria-label={t('fields.ticketMin')}
              value={ticket?.minAmountMinor || null}
              currency={currency}
              onChange={(minor) => setTicket('minAmountMinor', minor)}
            />
            <MoneyInput
              aria-label={t('fields.ticketMax')}
              value={ticket?.maxAmountMinor || null}
              currency={currency}
              onChange={(minor) => setTicket('maxAmountMinor', minor)}
            />
          </div>
        )}
      />
      <Field label={t('fields.currency')}>
        <Combobox
          options={options.currencies}
          value={currency}
          onValueChange={(code) => {
            const next = code ?? 'EUR';
            setCurrency(next);
            const current = form.getValues('ticket');
            if (current)
              form.setValue('ticket', { ...current, currency: next }, { shouldDirty: true });
          }}
        />
      </Field>
      <FormField
        control={form.control}
        name="acceptedInstruments"
        label={t('fields.instruments')}
        optional
        render={({ field }) => (
          <Combobox
            multiple
            options={options.instruments}
            value={field.value ?? []}
            placeholder={t('fields.choose')}
            onValueChange={(codes) => field.onChange(codes)}
          />
        )}
      />
      <FormField
        control={form.control}
        name="patronageTypes"
        label={t('fields.patronage')}
        optional
        render={({ field }) => (
          <Combobox
            multiple
            options={options.patronage}
            value={field.value ?? []}
            placeholder={t('fields.choose')}
            onValueChange={(codes) => field.onChange(codes)}
          />
        )}
      />
      <div className="grid gap-3">
        <Checkbox
          label={t('fields.mentoring')}
          checked={mentoring ?? false}
          onCheckedChange={(checked) =>
            form.setValue('mentoringAvailable', checked === true, { shouldDirty: true })
          }
        />
        <Checkbox
          label={t('fields.missions')}
          checked={missions ?? false}
          onCheckedChange={(checked) =>
            form.setValue('openToExpertMissions', checked === true, { shouldDirty: true })
          }
        />
      </div>
      <FormActions>
        <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('saving')}>
          {facet ? t('save') : t('contributor.create')}
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
                {t('contributor.delete')}
              </Button>
            }
            title={t('contributor.deleteTitle')}
            description={t('contributor.deleteDescription')}
            confirmLabel={t('contributor.delete')}
            onConfirm={async () => {
              await meControllerDeleteContributorFacet();
              onSaved();
            }}
          />
        ) : null}
      </FormActions>
    </Form>
  );
}
