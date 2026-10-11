'use client';

import {
  ApiProblemError,
  missionsControllerOffer,
  missionsControllerRequest,
  useProfilesControllerReferenceData,
  useProjectsControllerMine,
} from '@pitchorium/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import {
  Button,
  DeferredCombobox,
  DeferredSelect,
  Form,
  FormActions,
  FormField,
  Input,
  RadioGroup,
  Textarea,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { useCompletePrerequisites, useWithPrerequisites } from '@/features/access';
import { languageOptions } from '@/features/profiles';
import { useRouter } from '@/i18n/navigation';
import { countryOptions } from '@/lib/format/countries';
import {
  MISSION_CAPACITY_MAX,
  MISSION_COUNTRIES_MAX,
  MISSION_DESCRIPTION_MAX_LENGTH,
  MISSION_DOMAIN_MAX_LENGTH,
  MISSION_FORMATS,
  MISSION_KINDS,
  MISSION_LANGUAGES_MAX,
  MISSION_MAX_HOURS,
  MISSION_MODES,
  MISSION_SECTORS_MAX,
  MISSION_TITLE_MAX_LENGTH,
  type MissionDirection,
} from '../lib/limits';
import { missionFormSchema, type MissionFormValues } from '../lib/schemas';

const NONE = 'none';

/**
 * Creation of a mission (§6.3, ADR 0071): an offer of an expert or a mentor (the hat is asked
 * when it lacks: the contributor facet opens, then the offer is sent again), or a request of an
 * entrepreneur or of the team of a project. Everything says the mission is volunteer; a vocabulary
 * of job offer or too many hours for the format is refused by the api and explained under its
 * field.
 */
export function MissionForm({ direction: initial }: { direction: MissionDirection }) {
  const t = useTranslations('web.missions.form');
  const reference = useTranslations('reference');
  const locale = useLocale();
  const router = useRouter();
  const withPrerequisites = useWithPrerequisites();
  const complete = useCompletePrerequisites();
  const form = useZodForm(missionFormSchema, {
    defaultValues: {
      direction: initial,
      title: '',
      description: '',
      kind: 'mentoring',
      domain: '',
      sectorCodes: [],
      format: 'session',
      estimatedHours: '',
      mode: 'remote',
      countryCodes: [],
      languages: [locale],
      capacity: '1',
      skills: '',
      desiredBy: '',
      visibility: 'members',
      project: NONE,
    },
  });
  const limits = { session: MISSION_MAX_HOURS.session, short: MISSION_MAX_HOURS.short_mission };
  const applyProblem = useApplyProblem(form, {
    fields: {
      MISSIONS_JOB_POSTING_REFUSED: 'description',
      MISSIONS_HOURS_EXCEEDED: { field: 'estimatedHours', values: limits },
      MISSIONS_PROJECT_ROLE_REQUIRED: 'project',
      MISSIONS_FIELDS_INVALID: 'mode',
    },
  });
  const [direction, format] = useWatch({ control: form.control, name: ['direction', 'format'] });
  const data = useProfilesControllerReferenceData({ query: { staleTime: Infinity } }).data;
  const projects = useProjectsControllerMine({ query: { enabled: direction === 'request' } });
  const options = useMemo(
    () => ({
      sectors: (data?.sectors ?? []).map(({ code }) => ({
        value: code,
        label: reference(`sectors.${code}` as never),
      })),
      countries: countryOptions(
        (data?.countries ?? []).map(({ code }) => code),
        locale,
      ),
      languages: languageOptions(locale),
      projects: [
        { value: NONE, label: t('projectNone') },
        ...(projects.data?.items ?? []).map(({ project }) => ({
          value: project.id,
          label: project.title,
        })),
      ],
    }),
    [data, projects.data, reference, locale, t],
  );

  async function submit(values: MissionFormValues) {
    const offer = values.direction === 'offer';
    const common = {
      title: values.title,
      description: values.description,
      kind: values.kind,
      domain: values.domain,
      sectorCodes: values.sectorCodes ?? [],
      format: values.format,
      estimatedHours: Number(values.estimatedHours),
      mode: values.mode,
      countryCodes: values.countryCodes ?? [],
      languages: values.languages,
      visibility: values.visibility,
    };
    const send = () =>
      offer
        ? missionsControllerOffer({
            ...common,
            capacity: Number(values.capacity || 1),
          })
        : missionsControllerRequest({
            ...common,
            skills: (values.skills ?? '')
              .split('\n')
              .map((skill) => skill.trim())
              .filter(Boolean),
            desiredBy: values.desiredBy || null,
            projectId: values.project && values.project !== NONE ? values.project : null,
          });
    try {
      let mission;
      try {
        mission = await withPrerequisites(send);
      } catch (error) {
        // An offer needs the hat of an expert or a mentor: its facet opens, then the offer again.
        if (
          offer &&
          error instanceof ApiProblemError &&
          error.problem.code === 'MISSIONS_HAT_REQUIRED' &&
          complete &&
          (await complete(['profile.contributor_facet']))
        ) {
          mission = await send();
        } else {
          throw error;
        }
      }
      router.push(routes.mission(mission.id));
    } catch (error) {
      applyProblem(error);
    }
  }

  return (
    <Form form={form} onSubmit={submit} aria-label={t('title')}>
      <FormField
        control={form.control}
        name="direction"
        label={t('direction')}
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            options={(['offer', 'request'] as const).map((value) => ({
              value,
              label: t(`directions.${value}`),
              description: t(`directionHints.${value}`),
            }))}
          />
        )}
      />
      {direction === 'request' && options.projects.length > 1 ? (
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
      ) : null}
      <FormField
        control={form.control}
        name="title"
        label={t('missionTitle')}
        maxLength={MISSION_TITLE_MAX_LENGTH}
        render={({ field }) => <Input {...field} value={field.value ?? ''} />}
      />
      <FormField
        control={form.control}
        name="description"
        label={t('description')}
        description={t(`descriptionHints.${direction}`)}
        maxLength={MISSION_DESCRIPTION_MAX_LENGTH}
        render={({ field }) => <Textarea {...field} value={field.value ?? ''} rows={8} />}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="kind"
          label={t('kind')}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              options={MISSION_KINDS.map((value) => ({
                value,
                label: reference(`timeEntryKinds.${value}`),
              }))}
            />
          )}
        />
        <FormField
          control={form.control}
          name="domain"
          label={t('domain')}
          description={t('domainHint')}
          maxLength={MISSION_DOMAIN_MAX_LENGTH}
          render={({ field }) => <Input {...field} value={field.value ?? ''} />}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="format"
          label={t('format')}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              options={MISSION_FORMATS.map((value) => ({
                value,
                label: reference(`missionFormats.${value}`),
                description: t('formatHours', { hours: MISSION_MAX_HOURS[value] }),
              }))}
            />
          )}
        />
        <FormField
          control={form.control}
          name="estimatedHours"
          label={t('estimatedHours')}
          description={t('estimatedHoursHint', { hours: MISSION_MAX_HOURS[format] })}
          render={({ field }) => <Input {...field} value={field.value ?? ''} inputMode="numeric" />}
        />
      </div>
      <FormField
        control={form.control}
        name="mode"
        label={t('mode')}
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            options={MISSION_MODES.map((value) => ({
              value,
              label: reference(`missionModes.${value}`),
            }))}
          />
        )}
      />
      <FormField
        control={form.control}
        name="countryCodes"
        label={t('countries')}
        description={t('countriesHint')}
        optional
        render={({ field }) => (
          <DeferredCombobox
            multiple
            max={MISSION_COUNTRIES_MAX}
            options={options.countries}
            value={field.value ?? []}
            placeholder={t('choose')}
            onValueChange={field.onChange}
          />
        )}
      />
      <FormField
        control={form.control}
        name="languages"
        label={t('languages')}
        render={({ field }) => (
          <DeferredCombobox
            multiple
            max={MISSION_LANGUAGES_MAX}
            options={options.languages}
            value={field.value ?? []}
            placeholder={t('choose')}
            onValueChange={field.onChange}
          />
        )}
      />
      <FormField
        control={form.control}
        name="sectorCodes"
        label={t('sectors')}
        optional
        render={({ field }) => (
          <DeferredCombobox
            multiple
            max={MISSION_SECTORS_MAX}
            options={options.sectors}
            value={field.value ?? []}
            placeholder={t('choose')}
            onValueChange={field.onChange}
          />
        )}
      />
      {direction === 'offer' ? (
        <FormField
          control={form.control}
          name="capacity"
          label={t('capacity')}
          description={t('capacityHint', { max: MISSION_CAPACITY_MAX })}
          render={({ field }) => <Input {...field} value={field.value ?? ''} inputMode="numeric" />}
        />
      ) : (
        <>
          <FormField
            control={form.control}
            name="skills"
            label={t('skills')}
            description={t('skillsHint')}
            optional
            render={({ field }) => <Textarea {...field} value={field.value ?? ''} rows={3} />}
          />
          <FormField
            control={form.control}
            name="desiredBy"
            label={t('desiredBy')}
            optional
            render={({ field }) => <Input {...field} value={field.value ?? ''} type="date" />}
          />
        </>
      )}
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
              label: reference(`missionVisibilities.${value}`),
              description: t(`visibilityHints.${value}`),
            }))}
          />
        )}
      />
      <FormActions>
        <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('publishing')}>
          {t('publish')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t('cancel')}
        </Button>
      </FormActions>
    </Form>
  );
}
