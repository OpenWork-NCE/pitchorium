'use client';

import {
  accountControllerCurrent,
  getMeControllerProfileQueryKey,
  type LegalVersionsDtoOutput,
  meControllerMe,
  meControllerUpdateProfile,
  useMeControllerProfile,
  useProfilesControllerReferenceData,
} from '@pitchorium/api-client';
import { type MinimumProfile, minimumProfileSchema } from '@pitchorium/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Button,
  FieldSkeleton,
  Form,
  FormActions,
  FormField,
  Input,
  Spinner,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { routes } from '@/config/routes';
import type { PrerequisiteFormProps } from '@/features/access';
import { Link, useRouter } from '@/i18n/navigation';
import { countryOptions } from '@/lib/format/countries';
import { authCall, useAuthFailureMessage } from '../lib/auth-call';
import { absoluteUrl } from './auth/targets';
import { useCurrentMember } from './current-member';
import { LegalAcceptanceForm } from './onboarding/legal-acceptance-form';

/** Address to verify: a new link, then « C'est fait » checks the account again. */
function EmailVerifiedForm({ onDone }: PrerequisiteFormProps) {
  const t = useTranslations('web.prerequisites.email');
  const member = useCurrentMember();
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'checking' | 'pending'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState('sending');
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.sendVerificationEmail({
        email: member.user.email,
        callbackURL: absoluteUrl(locale, routes.emailVerified),
        fetchOptions,
      }),
    );
    setState(outcome.ok ? 'sent' : 'idle');
    setError(outcome.ok ? null : message(outcome.failure));
  }

  async function check() {
    setState('checking');
    const fresh = await meControllerMe();
    if (fresh.user.emailVerified) onDone();
    else setState('pending');
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm">{t('body', { email: member.user.email })}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          loading={state === 'sending'}
          loadingLabel={t('sending')}
          onClick={() => void send()}
        >
          {t('send')}
        </Button>
        <Button
          loading={state === 'checking'}
          loadingLabel={t('checking')}
          onClick={() => void check()}
        >
          {t('done')}
        </Button>
      </div>
      <p role="status" className="text-sm">
        {state === 'sent' ? t('sent') : state === 'pending' ? t('pending') : null}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Terms in force, accepted in place. */
function LegalForm({ onDone }: PrerequisiteFormProps) {
  const [versions, setVersions] = useState<LegalVersionsDtoOutput | null>(null);
  useEffect(() => {
    void accountControllerCurrent().then(setVersions);
  }, []);
  if (!versions) return <Spinner size="sm" />;
  return <LegalAcceptanceForm versions={versions} onAccepted={onDone} />;
}

const Combobox = lazy(() =>
  import('@/components/ui/combobox').then((module) => ({ default: module.Combobox })),
);

/**
 * Minimum profile (`profile.minimum`, ADR 0109): name, title and country, asked by the api before
 * a connection request or a first message out of network. Saved at once, then the action resumes.
 */
function MinimumProfileForm({ onDone }: PrerequisiteFormProps) {
  const own = useMeControllerProfile({ query: { staleTime: 0 } });
  if (!own.data) return <Spinner size="sm" />;
  return (
    <MinimumProfileFields
      initial={{
        displayName: own.data.displayName,
        headline: own.data.headline ?? '',
        countryCode: own.data.countryCode ?? '',
      }}
      onDone={onDone}
    />
  );
}

function MinimumProfileFields({
  initial,
  onDone,
}: {
  initial: MinimumProfile;
  onDone: () => void;
}) {
  const t = useTranslations('web.prerequisites.minimumProfile');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reference = useProfilesControllerReferenceData({ query: { staleTime: Infinity } });
  const countries = useMemo(
    () => countryOptions(reference.data?.countries.map(({ code }) => code) ?? [], locale),
    [reference.data, locale],
  );
  const form = useZodForm(minimumProfileSchema, { defaultValues: initial });
  const applyProblem = useApplyProblem(form);

  async function submit(values: MinimumProfile) {
    try {
      await meControllerUpdateProfile(values);
    } catch (error) {
      applyProblem(error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: getMeControllerProfileQueryKey() });
    // The header and the menus read the member from the server: they show the new name.
    router.refresh();
    onDone();
  }

  return (
    <Form form={form} onSubmit={submit} aria-label={t('label')}>
      <p className="text-sm">{t('body')}</p>
      <FormField
        control={form.control}
        name="displayName"
        label={t('name')}
        render={({ field }) => <Input {...field} autoComplete="name" />}
      />
      <FormField
        control={form.control}
        name="headline"
        label={t('headline')}
        description={t('headlineHint')}
        render={({ field }) => <Input {...field} autoComplete="organization-title" />}
      />
      <FormField
        control={form.control}
        name="countryCode"
        label={t('country')}
        render={({ field }) => (
          <Suspense fallback={<FieldSkeleton hint={t('countryPlaceholder')} />}>
            <Combobox
              options={countries}
              value={field.value || null}
              placeholder={t('countryPlaceholder')}
              onValueChange={(code) => field.onChange(code ?? '')}
            />
          </Suspense>
        )}
      />
      <FormActions>
        <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('saving')}>
          {t('submit')}
        </Button>
      </FormActions>
    </Form>
  );
}

/** The second factor is turned on in the security settings (QR code, backup codes). */
function TwoFactorForm(_: PrerequisiteFormProps) {
  const t = useTranslations('web.prerequisites.twoFactor');
  return (
    <div className="grid gap-4">
      <p className="text-sm">{t('body')}</p>
      <Button asChild>
        <Link href={routes.settingsSecurity}>{t('action')}</Link>
      </Button>
    </div>
  );
}

export { EmailVerifiedForm, LegalForm, MinimumProfileForm, TwoFactorForm };
