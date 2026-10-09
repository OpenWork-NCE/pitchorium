'use client';

import type { AuthConfigurationDtoOutput } from '@pitchorium/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { authCall, useAuthFailureMessage } from '../../lib/auth-call';
import { absoluteUrl, continuePath } from './targets';

type OAuthProvider = AuthConfigurationDtoOutput['oauthProviders'][number];

/** Logos of the providers as their brand guidelines give them (public/providers). */
const LOGOS: Record<OAuthProvider, string> = {
  google: '/providers/google.svg',
  linkedin: '/providers/linkedin.svg',
  microsoft: '/providers/microsoft.svg',
};

/**
 * « Continuer avec Google, LinkedIn, Microsoft » (§7.2), in this order, only for the providers the
 * api enables: one button signs in or creates the account, without any choice of role. A new
 * account goes to the onboarding, a known one to the page asked for.
 */
export function OAuthButtons({
  providers,
  redirectTo,
}: {
  providers: readonly OAuthProvider[];
  redirectTo: string | null;
}) {
  const t = useTranslations('web.auth.oauth');
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (providers.length === 0) return null;

  async function start(provider: OAuthProvider) {
    setPending(provider);
    setError(null);
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.signIn.social({
        provider,
        callbackURL: absoluteUrl(locale, continuePath(redirectTo)),
        newUserCallbackURL: absoluteUrl(locale, routes.onboarding),
        errorCallbackURL: absoluteUrl(locale, routes.authError),
        fetchOptions,
      }),
    );
    // On success the client follows the redirect to the provider.
    if (!outcome.ok) {
      setPending(null);
      setError(message(outcome.failure));
    }
  }

  return (
    <div className="grid gap-3">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          size="lg"
          className="w-full justify-center gap-3"
          loading={pending === provider}
          loadingLabel={t('redirecting')}
          disabled={pending !== null && pending !== provider}
          onClick={() => void start(provider)}
        >
          {/* A decorative logo: the label names the provider. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGOS[provider]} alt="" width={20} height={20} className="size-5" />
          {t(`continueWith.${provider}`)}
        </Button>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
