'use client';

import {
  meControllerUpdateProfile,
  useProfilesControllerReferenceData,
} from '@pitchorium/api-client';
import { updateBaseProfileRequestSchema } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Button,
  Combobox,
  Form,
  FormActions,
  FormField,
  Input,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { countryOptions } from '@/lib/format/countries';
import { languageOptions } from '../../lib/options';
import type { EditorProps } from '../profile-editor';
import { EditorDialog, orNull } from './editor-dialog';

const introSchema = updateBaseProfileRequestSchema.pick({
  displayName: true,
  headline: true,
  countryCode: true,
  city: true,
  languages: true,
  links: true,
});

type IntroValues = {
  displayName?: string;
  headline?: string | null;
  countryCode?: string | null;
  city?: string | null;
  languages?: string[];
  links?: { website: string | null; linkedin: string | null };
};

/**
 * Name, title, place, languages and links of the profile (§10.1): the head of the page. An
 * empty optional field clears its value.
 */
export function IntroEditor({ own, locale, onClose }: EditorProps) {
  const t = useTranslations('web.profile.edit');
  const reference = useProfilesControllerReferenceData({ query: { staleTime: Infinity } });
  const countries = useMemo(
    () => countryOptions(reference.data?.countries.map(({ code }) => code) ?? [], locale),
    [reference.data, locale],
  );
  const languages = useMemo(() => languageOptions(locale), [locale]);
  const form = useZodForm(introSchema, {
    defaultValues: {
      displayName: own.displayName,
      headline: own.headline,
      countryCode: own.countryCode,
      city: own.city,
      languages: own.languages,
      links: own.links,
    } as IntroValues,
  });
  const applyProblem = useApplyProblem(form);

  async function submit(values: IntroValues) {
    try {
      await meControllerUpdateProfile({
        ...values,
        headline: orNull(values.headline),
        city: orNull(values.city),
        links: {
          website: orNull(values.links?.website),
          linkedin: orNull(values.links?.linkedin),
        },
      });
    } catch (error) {
      applyProblem(error);
      return;
    }
    onClose(true);
  }

  return (
    <EditorDialog title={t('intro.title')} onClose={() => onClose(false)} size="lg">
      <Form form={form} onSubmit={submit} aria-label={t('intro.title')}>
        <FormField
          control={form.control}
          name="displayName"
          label={t('fields.name')}
          render={({ field }) => <Input {...field} value={field.value ?? ''} autoComplete="name" />}
        />
        <FormField
          control={form.control}
          name="headline"
          label={t('fields.headline')}
          description={t('fields.headlineHint')}
          optional
          maxLength={220}
          render={({ field }) => (
            <Input {...field} value={field.value ?? ''} autoComplete="organization-title" />
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="countryCode"
            label={t('fields.country')}
            optional
            render={({ field }) => (
              <Combobox
                options={countries}
                value={field.value ?? null}
                placeholder={t('fields.countryPlaceholder')}
                onValueChange={(code) => field.onChange(code)}
              />
            )}
          />
          <FormField
            control={form.control}
            name="city"
            label={t('fields.city')}
            optional
            render={({ field }) => (
              <Input {...field} value={field.value ?? ''} autoComplete="address-level2" />
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="languages"
          label={t('fields.languages')}
          description={t('fields.languagesHint')}
          optional
          render={({ field }) => (
            <Combobox
              multiple
              max={20}
              options={languages}
              value={field.value ?? []}
              placeholder={t('fields.languagesPlaceholder')}
              onValueChange={(codes) => field.onChange(codes)}
            />
          )}
        />
        <FormField
          control={form.control}
          name="links.website"
          label={t('fields.website')}
          optional
          render={({ field }) => (
            <Input {...field} value={field.value ?? ''} type="url" autoComplete="url" />
          )}
        />
        <FormField
          control={form.control}
          name="links.linkedin"
          label={t('fields.linkedin')}
          description={t('fields.linkedinHint')}
          optional
          render={({ field }) => (
            <Input {...field} value={field.value ?? ''} type="url" autoComplete="url" />
          )}
        />
        <FormActions>
          <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('saving')}>
            {t('save')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onClose(false)}>
            {t('cancel')}
          </Button>
        </FormActions>
      </Form>
    </EditorDialog>
  );
}
