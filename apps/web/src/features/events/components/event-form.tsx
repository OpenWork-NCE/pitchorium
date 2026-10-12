'use client';

import {
  eventsControllerCreate,
  eventsControllerUpdate,
  getOrganizationsControllerMineQueryOptions,
  getProfilesControllerReferenceDataQueryOptions,
  getProjectsControllerMineQueryOptions,
} from '@pitchorium/api-client';
import { useQuery } from '@tanstack/react-query';
import type { EventView } from '@pitchorium/contracts';
import { ImagePlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import {
  Button,
  DateTimeField,
  DeferredCombobox,
  DeferredSelect,
  Field,
  Form,
  FormActions,
  FormField,
  Input,
  RadioGroup,
  Text,
  Textarea,
  TimeZoneSelect,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { useWithPrerequisites } from '@/features/access';
import { languageOptions } from '@/features/profiles';
import { useRouter } from '@/i18n/navigation';
import { countryOptions } from '@/lib/format/countries';
import {
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_FORMATS,
  EVENT_IMAGE_ALT_MAX_LENGTH,
  EVENT_LOCATION_MAX_LENGTH,
  EVENT_SECTORS_MAX,
  EVENT_TITLE_MAX_LENGTH,
} from '../lib/limits';
import { eventFormSchema, type EventFormValues } from '../lib/schemas';

const ImageCropDialog = lazy(() =>
  import('@/features/media').then((module) => ({ default: module.ImageCropDialog })),
);

const SELF = 'self';
const NONE = 'none';

/** The zone of the browser, the first guess of the place of an event. */
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function defaults(event: EventView | null): EventFormValues {
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    format: event?.format ?? 'in_person',
    startsAt: event?.startsAt ?? '',
    endsAt: event?.endsAt ?? '',
    timeZone: event?.timeZone ?? browserZone(),
    location: {
      name: event?.location?.name ?? '',
      address: event?.location?.address ?? '',
      city: event?.location?.city ?? '',
      countryCode: event?.location?.countryCode ?? '',
    },
    onlineUrl: event?.onlineUrl ?? '',
    language: event?.language ?? 'fr',
    sectorCodes: event?.sectorCodes ?? [],
    capacity: event && event.capacity !== null ? String(event.capacity) : '',
    visibility: event?.visibility ?? 'members',
    imageMediaId: event?.imageMediaId ?? null,
    imageAlt: event?.imageAlt ?? '',
    organization: SELF,
    project: NONE,
  };
}

const orNull = (value: string | undefined | null) => (value?.trim() ? value.trim() : null);

/**
 * Creation and edition of an event (§14, ADR 0069): who organizes (the member, or an organisation
 * they own or administer), the project of their team it belongs to, the title and the restricted
 * Markdown description, the type, the dates on the clock of the place with its zone named once
 * (ADR 0100), the place or the link the type asks for, the language, the sectors, the seats, the
 * audience, the image framed in 16:9 with its text alternative. The api decides what each type
 * requires and the audience allowed; its refusal goes under the field it concerns.
 */
export function EventForm({ event }: { event: EventView | null }) {
  const t = useTranslations('web.events.form');
  const reference = useTranslations('reference');
  const locale = useLocale();
  const router = useRouter();
  const withPrerequisites = useWithPrerequisites();
  const editing = event !== null;
  const form = useZodForm(eventFormSchema, { defaultValues: defaults(event) });
  const applyProblem = useApplyProblem(form, {
    fields: {
      EVENTS_SCHEDULE_INVALID: { field: 'endsAt', values: { days: 14 } },
      EVENTS_LOCATION_REQUIRED: 'location.name',
      EVENTS_ONLINE_URL_REQUIRED: 'onlineUrl',
      EVENTS_DESCRIPTION_INVALID: 'description',
      EVENTS_PUBLIC_NOT_ALLOWED: 'visibility',
      EVENTS_ORGANIZATION_ROLE_REQUIRED: 'organization',
      EVENTS_PROJECT_ROLE_REQUIRED: 'project',
      EVENTS_CAPACITY_BELOW_REGISTERED: 'capacity',
    },
  });
  const [format, timeZone, startsAt, imageMediaId] = useWatch({
    control: form.control,
    name: ['format', 'timeZone', 'startsAt', 'imageMediaId'],
  });
  const [framing, setFraming] = useState(false);
  const reference_data = useQuery(
    getProfilesControllerReferenceDataQueryOptions({ query: { staleTime: Infinity } }),
  );
  const organizations = useQuery(
    getOrganizationsControllerMineQueryOptions({ query: { enabled: !editing } }),
  );
  const projects = useQuery(
    getProjectsControllerMineQueryOptions({ query: { enabled: !editing } }),
  );
  const options = useMemo(
    () => ({
      sectors: (reference_data.data?.sectors ?? []).map(({ code }) => ({
        value: code,
        label: reference(`sectors.${code}` as never),
      })),
      countries: countryOptions(
        (reference_data.data?.countries ?? []).map(({ code }) => code),
        locale,
      ),
      languages: languageOptions(locale),
      organizers: [
        { value: SELF, label: t('organizerSelf') },
        ...(organizations.data?.items ?? [])
          .filter((organization) => organization.role === 'owner' || organization.role === 'admin')
          .map((organization) => ({ value: organization.id, label: organization.name })),
      ],
      projects: [
        { value: NONE, label: t('projectNone') },
        ...(projects.data?.items ?? []).map(({ project }) => ({
          value: project.id,
          label: project.title,
        })),
      ],
    }),
    [reference_data.data, organizations.data, projects.data, reference, locale, t],
  );

  async function submit(values: EventFormValues) {
    const online = values.format !== 'in_person';
    const inPerson = values.format !== 'online';
    const body = {
      title: values.title,
      description: values.description ?? '',
      format: values.format,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      timeZone: values.timeZone,
      location: inPerson
        ? {
            name: values.location.name ?? '',
            address: orNull(values.location.address),
            city: values.location.city ?? '',
            countryCode: values.location.countryCode ?? '',
          }
        : null,
      onlineUrl: online ? orNull(values.onlineUrl) : null,
      language: values.language,
      sectorCodes: values.sectorCodes ?? [],
      capacity: values.capacity ? Number(values.capacity) : null,
      visibility: values.visibility,
      imageMediaId: values.imageMediaId ?? null,
      imageAlt: values.imageMediaId ? orNull(values.imageAlt) : null,
    };
    try {
      if (event) {
        await withPrerequisites(() => eventsControllerUpdate(event.id, body));
        router.push(routes.event(event.slug));
        router.refresh();
        return;
      }
      const created = await withPrerequisites(() =>
        eventsControllerCreate({
          ...body,
          organizationId: values.organization === SELF ? null : (values.organization ?? null),
          projectId: values.project === NONE ? null : (values.project ?? null),
        }),
      );
      router.push(routes.event(created.slug));
    } catch (error) {
      applyProblem(error);
    }
  }

  return (
    <Form form={form} onSubmit={submit} aria-label={editing ? t('editTitle') : t('createTitle')}>
      {editing ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="organization"
            label={t('organizer')}
            render={({ field }) => (
              <DeferredSelect
                options={options.organizers}
                value={field.value ?? SELF}
                onValueChange={field.onChange}
              />
            )}
          />
          <FormField
            control={form.control}
            name="project"
            label={t('project')}
            optional
            render={({ field }) => (
              <DeferredSelect
                options={options.projects}
                value={field.value ?? NONE}
                onValueChange={field.onChange}
              />
            )}
          />
        </div>
      )}
      <FormField
        control={form.control}
        name="title"
        label={t('title')}
        maxLength={EVENT_TITLE_MAX_LENGTH}
        render={({ field }) => <Input {...field} value={field.value ?? ''} />}
      />
      <FormField
        control={form.control}
        name="description"
        label={t('description')}
        description={t('descriptionHint')}
        optional
        maxLength={EVENT_DESCRIPTION_MAX_LENGTH}
        render={({ field }) => <Textarea {...field} value={field.value ?? ''} rows={8} />}
      />
      <FormField
        control={form.control}
        name="format"
        label={t('format')}
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            options={EVENT_FORMATS.map((value) => ({
              value,
              label: reference(`eventFormats.${value}`),
              description: t(`formatHints.${value}`),
            }))}
          />
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="startsAt"
          label={t('startsAt')}
          render={({ field }) => (
            <DateTimeField
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? '')}
              timeZone={timeZone}
            />
          )}
        />
        <FormField
          control={form.control}
          name="endsAt"
          label={t('endsAt')}
          render={({ field }) => (
            <DateTimeField
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? '')}
              timeZone={timeZone}
            />
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="timeZone"
        label={t('timeZone')}
        description={t('timeZoneHint')}
        render={({ field }) => (
          <TimeZoneSelect value={field.value} onChange={field.onChange} at={startsAt || null} />
        )}
      />
      {format !== 'online' ? (
        <fieldset className="grid gap-4">
          <legend className="mb-2 text-sm font-medium">{t('place')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="location.name"
              label={t('placeName')}
              maxLength={EVENT_LOCATION_MAX_LENGTH}
              render={({ field }) => <Input {...field} value={field.value ?? ''} />}
            />
            <FormField
              control={form.control}
              name="location.address"
              label={t('placeAddress')}
              optional
              maxLength={EVENT_LOCATION_MAX_LENGTH}
              render={({ field }) => (
                <Input {...field} value={field.value ?? ''} autoComplete="street-address" />
              )}
            />
            <FormField
              control={form.control}
              name="location.city"
              label={t('placeCity')}
              maxLength={100}
              render={({ field }) => (
                <Input {...field} value={field.value ?? ''} autoComplete="address-level2" />
              )}
            />
            <FormField
              control={form.control}
              name="location.countryCode"
              label={t('placeCountry')}
              render={({ field }) => (
                <DeferredCombobox
                  options={options.countries}
                  value={field.value || null}
                  placeholder={t('choose')}
                  onValueChange={(value) => field.onChange(value ?? '')}
                />
              )}
            />
          </div>
        </fieldset>
      ) : null}
      {format !== 'in_person' ? (
        <FormField
          control={form.control}
          name="onlineUrl"
          label={t('onlineUrl')}
          description={t('onlineUrlHint')}
          render={({ field }) => (
            <Input {...field} value={field.value ?? ''} type="url" inputMode="url" />
          )}
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="language"
          label={t('language')}
          render={({ field }) => (
            <DeferredCombobox
              options={options.languages}
              value={field.value || null}
              placeholder={t('choose')}
              onValueChange={(value) => field.onChange(value ?? '')}
            />
          )}
        />
        <FormField
          control={form.control}
          name="capacity"
          label={t('capacity')}
          description={t('capacityHint')}
          optional
          render={({ field }) => <Input {...field} value={field.value ?? ''} inputMode="numeric" />}
        />
      </div>
      <FormField
        control={form.control}
        name="sectorCodes"
        label={t('sectors')}
        optional
        render={({ field }) => (
          <DeferredCombobox
            multiple
            max={EVENT_SECTORS_MAX}
            options={options.sectors}
            value={field.value ?? []}
            placeholder={t('choose')}
            onValueChange={field.onChange}
          />
        )}
      />
      <FormField
        control={form.control}
        name="visibility"
        label={t('visibility')}
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            options={(['members', 'public'] as const).map((value) => ({
              value,
              label: reference(`eventVisibilities.${value}`),
              description: t(`visibilityHints.${value}`),
            }))}
          />
        )}
      />
      <Field label={t('image')} description={t('imageHint')} optional>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setFraming(true)}>
            <ImagePlus aria-hidden />
            {imageMediaId ? t('imageChange') : t('imageAdd')}
          </Button>
          {imageMediaId ? (
            <Text size="sm" tone="muted" data-image-ready="">
              {t('imageReady')}
            </Text>
          ) : null}
        </div>
      </Field>
      {imageMediaId ? (
        <FormField
          control={form.control}
          name="imageAlt"
          label={t('imageAlt')}
          description={t('imageAltHint')}
          maxLength={EVENT_IMAGE_ALT_MAX_LENGTH}
          render={({ field }) => <Textarea {...field} value={field.value ?? ''} rows={2} />}
        />
      ) : null}
      {framing ? (
        <Suspense fallback={null}>
          <ImageCropDialog
            kind="event_image"
            texts={{
              title: t('imageDialog.title'),
              description: t('imageDialog.description'),
              limits: t('imageDialog.limits'),
              remove: t('imageDialog.remove'),
              removeTitle: t('imageDialog.removeTitle'),
              removeDescription: t('imageDialog.removeDescription'),
            }}
            hasCurrent={imageMediaId !== null}
            attach={(mediaId) => {
              form.setValue('imageMediaId', mediaId, { shouldDirty: true });
              return Promise.resolve();
            }}
            remove={() => {
              form.setValue('imageMediaId', null, { shouldDirty: true });
              form.setValue('imageAlt', '');
              return Promise.resolve();
            }}
            onClose={() => setFraming(false)}
          />
        </Suspense>
      ) : null}
      <FormActions>
        <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('saving')}>
          {editing ? t('save') : t('create')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t('cancel')}
        </Button>
      </FormActions>
    </Form>
  );
}
