'use client';

import type { AuthConfigurationDtoOutput } from '@pitchorium/api-client';
import { MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { type AuthOutcome, authCall, useAuthFailureMessage } from '../../lib/auth-call';
import { AuthScreen } from './auth-screen';
import { sendMagicLink } from './magic-link-screen';
import { absoluteUrl } from './targets';
import { useTurnstile } from './turnstile';

export type EmailKind = 'verify' | 'magic' | 'reset';

/** Seconds before the email can be sent again, shown as a countdown. */
export const RESEND_DELAY_SECONDS = 60;

/** Remaining seconds of a countdown started at `startedAt` (ms), never below zero. */
export function remainingSeconds(startedAt: number, now: number, delay = RESEND_DELAY_SECONDS) {
  return Math.max(0, Math.ceil(delay - (now - startedAt) / 1000));
}

/**
 * Email sent (verification, sign-in link, reset): where to look, and a resend held back by a
 * visible delay. The text is the same whether or not the address has an account.
 */
export function CheckEmailScreen({
  config,
  kind,
  email,
  redirectTo,
}: {
  config: AuthConfigurationDtoOutput;
  kind: EmailKind;
  email: string | null;
  redirectTo: string | null;
}) {
  const t = useTranslations('web.auth.checkEmail');
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const turnstile = useTurnstile(kind === 'verify' ? null : config.turnstile, 'resend');
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const wait = remainingSeconds(startedAt, now);

  useEffect(() => {
    if (wait === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  async function resend() {
    if (!email) return;
    setState('sending');
    setError(null);
    const { authClient } = await import('@/lib/auth/client');
    let outcome: AuthOutcome<unknown>;
    if (kind === 'magic') {
      outcome = await sendMagicLink(locale, email, redirectTo, turnstile.token);
    } else if (kind === 'reset') {
      outcome = await authCall(
        (fetchOptions) =>
          authClient.requestPasswordReset({
            email,
            redirectTo: absoluteUrl(locale, routes.resetPassword),
            fetchOptions,
          }),
        turnstile.token,
      );
    } else {
      outcome = await authCall((fetchOptions) =>
        authClient.sendVerificationEmail({
          email,
          callbackURL: absoluteUrl(locale, routes.emailVerified),
          fetchOptions,
        }),
      );
    }
    turnstile.reset();
    if (outcome.ok) {
      setState('sent');
      setStartedAt(Date.now());
      setNow(Date.now());
    } else {
      setState('idle');
      setError(message(outcome.failure));
    }
  }

  return (
    <AuthScreen
      icon={<MailCheck aria-hidden className="size-10 text-accent" />}
      title={t(`${kind}.title`)}
      lede={email ? t(`${kind}.lede`, { email }) : t(`${kind}.ledeNoEmail`)}
    >
      <p className="text-sm text-muted">{t('spam')}</p>
      {email ? (
        <div className="grid gap-3">
          {turnstile.widget}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={wait > 0 || !turnstile.ready}
            loading={state === 'sending'}
            loadingLabel={t('sending')}
            onClick={() => void resend()}
          >
            {wait > 0 ? t('resendIn', { seconds: wait }) : t('resend')}
          </Button>
          <p role="status" className="text-sm">
            {state === 'sent' ? <span className="text-success">{t('sent')}</span> : null}
          </p>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
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
