'use client';

import type { AuthConfigurationDtoOutput } from '@pitchorium/api-client';
import { signUpRequestSchema } from '@pitchorium/contracts';
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
import { absoluteUrl } from './targets';
import { useTurnstile } from './turnstile';

/**
 * Account by email (§7.2): name, email and a password of 12 characters at least, nothing else.
 * The answer is the same for a known address (no account is revealed): the next screen says an
 * email was sent. The verification link signs the member in and opens the onboarding.
 */
export function SignUpScreen({
  config,
  redirectTo,
}: {
  config: AuthConfigurationDtoOutput;
  redirectTo: string | null;
}) {
  const t = useTranslations('web.auth.signUp');
  const locale = useLocale();
  const router = useRouter();
  const message = useAuthFailureMessage();
  const turnstile = useTurnstile(config.turnstile, 'sign-up');
  const form = useZodForm(signUpRequestSchema, {
    defaultValues: { name: '', email: '', password: '' },
  });

  async function submit(values: { name: string; email: string; password: string }) {
    if (!turnstile.ready) {
      form.setError('root.server', {
        message: message({ code: 'MISSING_RESPONSE', status: 400, retryAfter: null }),
      });
      return;
    }
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall(
      (fetchOptions) =>
        authClient.signUp.email({
          ...values,
          callbackURL: absoluteUrl(locale, routes.emailVerified),
          fetchOptions,
        }),
      turnstile.token,
    );
    turnstile.reset();
    if (!outcome.ok) {
      const text = message(outcome.failure);
      const code = outcome.failure.code?.toUpperCase();
      if (
        code === 'PASSWORD_COMPROMISED' ||
        code === 'PASSWORD_TOO_SHORT' ||
        code === 'PASSWORD_TOO_LONG'
      ) {
        form.setError('password', { type: code, message: text });
      } else {
        form.setError('root.server', { message: text });
      }
      return;
    }
    router.push(
      withRedirect(
        `${routes.checkEmail}?kind=verify&email=${encodeURIComponent(values.email)}`,
        redirectTo,
      ),
    );
  }

  return (
    <AuthScreen title={t('title')} lede={t('lede')}>
      <Form form={form} onSubmit={submit} aria-label={t('title')}>
        <FormField
          control={form.control}
          name="name"
          label={t('name')}
          render={({ field }) => <Input {...field} autoComplete="name" autoCapitalize="words" />}
        />
        <FormField
          control={form.control}
          name="email"
          label={t('email')}
          render={({ field }) => (
            <Input
              {...field}
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
            />
          )}
        />
        <FormField
          control={form.control}
          name="password"
          label={t('password')}
          description={t('passwordHint', { length: config.minPasswordLength })}
          render={({ field }) => <PasswordInput {...field} autoComplete="new-password" />}
        />
        {turnstile.widget}
        <FormActions>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            loading={form.formState.isSubmitting}
            loadingLabel={t('creating')}
          >
            {t('submit')}
          </Button>
        </FormActions>
      </Form>
      <p className="text-center text-sm">
        {t('haveAccount')}{' '}
        <Link
          href={withRedirect(routes.signIn, redirectTo)}
          className="link-underline-hover text-accent"
        >
          {t('signIn')}
        </Link>
      </p>
    </AuthScreen>
  );
}
