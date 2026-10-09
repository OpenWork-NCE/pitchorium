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
 * The email step (§7.2): a sign-in link by default, valid 15 minutes once, which signs in a known
 * address and creates the account of a new one; the next screen is the same either way, so that
 * it never says whether an account exists. A password is offered as the other way.
 */
export function EmailStep({
  config,
  redirectTo,
  entry = false,
}: {
  config: AuthConfigurationDtoOutput;
  redirectTo: string | null;
  /** The first screen itself, when no provider is enabled. */
  entry?: boolean;
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
    <AuthScreen title={t(entry ? 'entryTitle' : 'title')} lede={t('lede')}>
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
            className="w-full"
            loading={form.formState.isSubmitting}
            loadingLabel={t('sending')}
          >
            {t('submit')}
          </Button>
        </FormActions>
      </Form>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <Link
          href={withRedirect(routes.signInPassword, redirectTo)}
          className="link-underline-hover text-accent"
        >
          {t('usePassword')}
        </Link>
        {entry ? null : (
          <Link
            href={withRedirect(routes.signIn, redirectTo)}
            className="link-underline-hover text-muted"
          >
            {t('back')}
          </Link>
        )}
      </div>
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
