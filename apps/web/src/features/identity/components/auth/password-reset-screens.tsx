'use client';

import type { AuthConfigurationDtoOutput } from '@pitchorium/api-client';
import { emailRequest, newPasswordRequest } from '../../lib/auth-schemas';
import { LinkIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Button,
  DrawnCheck,
  Form,
  FormActions,
  FormField,
  Input,
  PasswordInput,
  useZodForm,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { Link, useRouter } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { authCall, useAuthFailureMessage } from '../../lib/auth-call';
import { AuthScreen } from './auth-screen';
import { absoluteUrl } from './targets';
import { useTurnstile } from './turnstile';

/** Forgotten password: a reset link valid 30 minutes, the same answer for any address. */
export function ForgotPasswordScreen({
  config,
  redirectTo,
}: {
  config: AuthConfigurationDtoOutput;
  redirectTo: string | null;
}) {
  const t = useTranslations('web.auth.forgotPassword');
  const locale = useLocale();
  const router = useRouter();
  const message = useAuthFailureMessage();
  const turnstile = useTurnstile(config.turnstile, 'password-reset');
  const form = useZodForm(emailRequest, { defaultValues: { email: '' } });

  async function submit({ email }: { email: string }) {
    // A submit made while the challenge runs waits for it rather than failing (ADR 0103).
    const passed = await turnstile.challenge();
    if (!passed) {
      form.setError('root.server', {
        message: message({ code: 'MISSING_RESPONSE', status: 400, retryAfter: null }),
      });
      return;
    }
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall(
      (fetchOptions) =>
        authClient.requestPasswordReset({
          email,
          redirectTo: absoluteUrl(locale, routes.resetPassword),
          fetchOptions,
        }),
      passed.token,
    );
    turnstile.reset();
    if (!outcome.ok) {
      form.setError('root.server', { message: message(outcome.failure) });
      return;
    }
    router.push(
      withRedirect(
        `${routes.checkEmail}?kind=reset&email=${encodeURIComponent(email)}`,
        redirectTo,
      ),
    );
  }

  return (
    <AuthScreen title={t('title')} lede={t('lede')}>
      <Form form={form} onSubmit={submit} aria-label={t('title')}>
        <FormField
          control={form.control}
          name="email"
          label={t('email')}
          render={({ field }) => (
            <Input
              {...field}
              type="email"
              autoComplete="username"
              inputMode="email"
              spellCheck={false}
            />
          )}
        />
        {turnstile.widget}
        <FormActions>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            loading={form.formState.isSubmitting}
            loadingLabel={t('sending')}
          >
            {t('submit')}
          </Button>
        </FormActions>
      </Form>
      <p className="text-center text-sm">
        <Link
          href={withRedirect(routes.signIn, redirectTo)}
          className="link-underline-hover text-accent"
        >
          {t('back')}
        </Link>
      </p>
    </AuthScreen>
  );
}

/**
 * New password from the reset link: every session is closed by the api, the member signs in
 * again. An expired or used link (`error` set by the api) asks for a new one.
 */
export function ResetPasswordScreen({
  token,
  error,
  minPasswordLength,
}: {
  token: string | null;
  error: string | null;
  minPasswordLength: number;
}) {
  const t = useTranslations('web.auth.resetPassword');
  const message = useAuthFailureMessage();
  const [done, setDone] = useState(false);
  const form = useZodForm(newPasswordRequest, { defaultValues: { newPassword: '' } });

  if (error || !token) {
    return (
      <AuthScreen
        icon={<LinkIcon aria-hidden className="size-10 text-warning" />}
        title={t('invalid.title')}
        lede={t('invalid.lede')}
      >
        <Button asChild className="w-full">
          <Link href={routes.forgotPassword}>{t('invalid.action')}</Link>
        </Button>
      </AuthScreen>
    );
  }
  if (done) {
    return (
      <AuthScreen icon={<DrawnCheck />} title={t('done.title')} lede={t('done.lede')}>
        <Button asChild className="w-full">
          <Link href={routes.signIn}>{t('done.action')}</Link>
        </Button>
      </AuthScreen>
    );
  }

  async function submit({ newPassword }: { newPassword: string }) {
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.resetPassword({ newPassword, token: token ?? '', fetchOptions }),
    );
    if (outcome.ok) {
      setDone(true);
      return;
    }
    const code = outcome.failure.code?.toUpperCase();
    if (code === 'PASSWORD_COMPROMISED' || code === 'PASSWORD_TOO_SHORT') {
      form.setError('newPassword', { type: code, message: message(outcome.failure) });
    } else {
      form.setError('root.server', { message: message(outcome.failure) });
    }
  }

  return (
    <AuthScreen title={t('title')} lede={t('lede')}>
      <Form form={form} onSubmit={submit} aria-label={t('title')}>
        {/* Lets a password manager tie the new password to the account. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <FormField
          control={form.control}
          name="newPassword"
          label={t('password')}
          description={t('passwordHint', { length: minPasswordLength })}
          render={({ field }) => <PasswordInput {...field} autoComplete="new-password" />}
        />
        <FormActions>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            loading={form.formState.isSubmitting}
            loadingLabel={t('saving')}
          >
            {t('submit')}
          </Button>
        </FormActions>
      </Form>
    </AuthScreen>
  );
}
