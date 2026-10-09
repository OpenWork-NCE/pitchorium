'use client';

import type { AuthConfigurationDtoOutput } from '@pitchorium/api-client';
import { signInRequestSchema } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
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
import { OAuthButtons } from './oauth-buttons';
import { landAfterSignIn } from './targets';
import { useTurnstile } from './turnstile';

/**
 * One entry for every method (§7.2, step 1): the OAuth buttons first, then email as the secondary
 * path (password or a link by email). Signing in and creating an account start here; no role is
 * asked. A refused password never says whether the account exists.
 */
export function SignInScreen({
  config,
  redirectTo,
}: {
  config: AuthConfigurationDtoOutput;
  redirectTo: string | null;
}) {
  const t = useTranslations('web.auth.signIn');
  const router = useRouter();
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const hasProviders = config.oauthProviders.length > 0;
  const [withEmail, setWithEmail] = useState(!hasProviders);
  const turnstile = useTurnstile(withEmail ? config.turnstile : null, 'sign-in');
  const form = useZodForm(signInRequestSchema, { defaultValues: { email: '', password: '' } });

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
      <OAuthButtons providers={config.oauthProviders} redirectTo={redirectTo} />
      {hasProviders ? (
        <div className="flex items-center gap-3 text-sm text-muted">
          <span aria-hidden className="h-px flex-1 bg-border" />
          <span>{t('or')}</span>
          <span aria-hidden className="h-px flex-1 bg-border" />
        </div>
      ) : null}
      {withEmail ? (
        <Form form={form} onSubmit={submit} aria-label={t('emailForm')}>
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
              className="w-full sm:w-auto"
              loading={form.formState.isSubmitting}
              loadingLabel={t('signingIn')}
            >
              {t('submit')}
            </Button>
          </FormActions>
        </Form>
      ) : (
        <Button
          type="button"
          variant="link"
          className="justify-self-center"
          onClick={() => setWithEmail(true)}
        >
          {t('continueWithEmail')}
        </Button>
      )}
      <ul className="grid gap-2 text-center text-sm">
        <li>
          <Link
            href={withRedirect(routes.magicLink, redirectTo)}
            className="link-underline-hover text-accent"
          >
            {t('magicLink')}
          </Link>
        </li>
        <li>
          {t('noAccount')}{' '}
          <Link
            href={withRedirect(routes.signUp, redirectTo)}
            className="link-underline-hover text-accent"
          >
            {t('signUp')}
          </Link>
        </li>
      </ul>
    </AuthScreen>
  );
}
