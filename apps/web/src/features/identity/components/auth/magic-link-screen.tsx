'use client';

import type { AuthConfigurationDtoOutput } from '@pitchorium/api-client';
import { emailRequestSchema } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { Button, Form, FormActions, FormField, Input, useZodForm } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link, useRouter } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { authCall, useAuthFailureMessage } from '../../lib/auth-call';
import { AuthScreen } from './auth-screen';
import { absoluteUrl, continuePath } from './targets';
import { useTurnstile } from './turnstile';

/**
 * Sign in without a password (§7.2): a link valid 15 minutes, once. Known address or not, the
 * next screen is the same; a new address gets an account and the onboarding.
 */
export function MagicLinkScreen({
  config,
  redirectTo,
}: {
  config: AuthConfigurationDtoOutput;
  redirectTo: string | null;
}) {
  const t = useTranslations('web.auth.magicLink');
  const locale = useLocale();
  const router = useRouter();
  const message = useAuthFailureMessage();
  const turnstile = useTurnstile(config.turnstile, 'magic-link');
  const form = useZodForm(emailRequestSchema, { defaultValues: { email: '' } });

  async function submit({ email }: { email: string }) {
    if (!turnstile.ready) {
      form.setError('root.server', {
        message: message({ code: 'MISSING_RESPONSE', status: 400, retryAfter: null }),
      });
      return;
    }
    const outcome = await sendMagicLink(locale, email, redirectTo, turnstile.token);
    turnstile.reset();
    if (!outcome.ok) {
      form.setError('root.server', { message: message(outcome.failure) });
      return;
    }
    router.push(
      withRedirect(
        `${routes.checkEmail}?kind=magic&email=${encodeURIComponent(email)}`,
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
              autoComplete="email"
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

/** Asks the api for a sign-in link (also used by the resend of the email-sent screen). */
export async function sendMagicLink(
  locale: string,
  email: string,
  redirectTo: string | null,
  captcha: string | null,
) {
  const { authClient } = await import('@/lib/auth/client');
  return authCall(
    (fetchOptions) =>
      authClient.signIn.magicLink({
        email,
        callbackURL: absoluteUrl(locale, continuePath(redirectTo)),
        newUserCallbackURL: absoluteUrl(locale, routes.onboarding),
        errorCallbackURL: absoluteUrl(locale, `${routes.emailVerified}?kind=magic`),
        fetchOptions,
      }),
    captcha,
  );
}
