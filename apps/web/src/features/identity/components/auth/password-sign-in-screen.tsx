'use client';

import type { AuthConfigurationDtoOutput } from '@pitchorium/api-client';
import { signInRequest } from '../../lib/auth-schemas';
import { useLocale, useTranslations } from 'next-intl';
import {
  Button,
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
import { landAfterSignIn } from './targets';
import { useTurnstile } from './turnstile';

/**
 * Sign in with a password, the other way of the email step. A refused password never says
 * whether the account exists; an account with a second factor goes on to its code.
 */
export function PasswordSignInScreen({
  config,
  redirectTo,
}: {
  config: AuthConfigurationDtoOutput;
  redirectTo: string | null;
}) {
  const t = useTranslations('web.auth.password');
  const router = useRouter();
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const turnstile = useTurnstile(config.turnstile, 'sign-in');
  const form = useZodForm(signInRequest, { defaultValues: { email: '', password: '' } });

  async function submit(values: { email: string; password: string }) {
    if (!turnstile.ready) {
      form.setError('root.server', {
        message: message({ code: 'MISSING_RESPONSE', status: 400, retryAfter: null }),
      });
      return;
    }
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall<{ twoFactorRedirect?: boolean }>(
      (fetchOptions) => authClient.signIn.email({ ...values, fetchOptions }),
      turnstile.token,
    );
    turnstile.reset();
    if (!outcome.ok) {
      form.setError('root.server', { message: message(outcome.failure) });
      return;
    }
    if (outcome.data.twoFactorRedirect) {
      router.push(withRedirect(routes.twoFactor, redirectTo));
      return;
    }
    landAfterSignIn(locale, redirectTo);
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
        <FormField
          control={form.control}
          name="password"
          label={t('password')}
          render={({ field }) => <PasswordInput {...field} autoComplete="current-password" />}
        />
        <p className="-mt-2 text-sm">
          <Link
            href={withRedirect(routes.forgotPassword, redirectTo)}
            className="link-underline-hover text-accent"
          >
            {t('forgotPassword')}
          </Link>
        </p>
        {turnstile.widget}
        <FormActions>
          <Button
            type="submit"
            className="w-full"
            loading={form.formState.isSubmitting}
            loadingLabel={t('signingIn')}
          >
            {t('submit')}
          </Button>
        </FormActions>
      </Form>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <Link
          href={withRedirect(routes.magicLink, redirectTo)}
          className="link-underline-hover text-accent"
        >
          {t('useLink')}
        </Link>
        <Link
          href={withRedirect(routes.signUp, redirectTo)}
          className="link-underline-hover text-accent"
        >
          {t('signUp')}
        </Link>
      </div>
    </AuthScreen>
  );
}
