'use client';

import { emailRequest } from '../../lib/auth-schemas';
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
  useZodForm,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { authCall, useAuthFailureMessage } from '../../lib/auth-call';
import { AuthScreen } from './auth-screen';
import { absoluteUrl } from './targets';

/**
 * Arrival from a link sent by email. Verified: a drawn check (H18), then the onboarding. Expired
 * or invalid (`error` set by the api): what happened and how to get a new link.
 */
export function EmailVerifiedScreen({
  error,
  kind,
}: {
  error: string | null;
  kind: 'verify' | 'magic';
}) {
  const t = useTranslations('web.auth.emailVerified');
  const locale = useLocale();
  if (!error) {
    return (
      <AuthScreen icon={<DrawnCheck />} title={t('title')} lede={t('lede')}>
        <Button asChild className="w-full">
          {/* A full navigation: the onboarding reads the session the link opened. */}
          <a href={`/${locale}${routes.onboarding}`}>{t('continue')}</a>
        </Button>
      </AuthScreen>
    );
  }
  const expired =
    error.toUpperCase() === 'TOKEN_EXPIRED' || error.toUpperCase() === 'EXPIRED_TOKEN';
  return (
    <AuthScreen
      icon={<LinkIcon aria-hidden className="size-10 text-warning" />}
      title={t(expired ? 'expired.title' : 'invalid.title')}
      lede={t(kind === 'magic' ? 'magicLede' : 'verifyLede')}
    >
      {kind === 'magic' ? (
        <Button asChild className="w-full">
          <Link href={routes.magicLink}>{t('newMagicLink')}</Link>
        </Button>
      ) : (
        <ResendVerification />
      )}
    </AuthScreen>
  );
}

/** A new verification link for an address typed again (same answer for any address). */
function ResendVerification() {
  const t = useTranslations('web.auth.emailVerified');
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const [sent, setSent] = useState(false);
  const form = useZodForm(emailRequest, { defaultValues: { email: '' } });

  async function submit({ email }: { email: string }) {
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.sendVerificationEmail({
        email,
        callbackURL: absoluteUrl(locale, routes.emailVerified),
        fetchOptions,
      }),
    );
    if (outcome.ok) setSent(true);
    else form.setError('root.server', { message: message(outcome.failure) });
  }

  if (sent) {
    return (
      <p role="status" className="text-sm text-success">
        {t('resent')}
      </p>
    );
  }
  return (
    <Form form={form} onSubmit={submit} aria-label={t('resend')}>
      <FormField
        control={form.control}
        name="email"
        label={t('email')}
        render={({ field }) => (
          <Input {...field} type="email" autoComplete="email" inputMode="email" />
        )}
      />
      <FormActions>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          loading={form.formState.isSubmitting}
          loadingLabel={t('sending')}
        >
          {t('resend')}
        </Button>
      </FormActions>
    </Form>
  );
}
