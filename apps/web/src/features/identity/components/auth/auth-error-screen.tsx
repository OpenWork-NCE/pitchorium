'use client';

import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { AuthScreen } from './auth-screen';

/** Kinds of failure of a sign-in with a provider, each with its own explanation. */
export type OAuthFailure = 'denied' | 'unverified' | 'notLinkable' | 'generic';

/** The `error` parameter of Better Auth (lower or upper case) as a kind of failure. */
export function oauthFailureOf(error: string | null): OAuthFailure {
  switch (error?.toUpperCase() ?? '') {
    case 'ACCESS_DENIED':
      return 'denied';
    case 'EMAIL_NOT_VERIFIED':
      return 'unverified';
    case 'ACCOUNT_NOT_LINKED':
    case 'UNABLE_TO_LINK_ACCOUNT':
    case 'LINKED_ACCOUNT_ALREADY_EXISTS':
      return 'notLinkable';
    default:
      return 'generic';
  }
}

/**
 * Failure of a sign-in with Google, LinkedIn or Microsoft. An address already used by another
 * account that cannot be linked on its own (ADR 0014): sign in with the usual method, then link
 * the provider from the settings of the account.
 */
export function AuthErrorScreen({ error }: { error: string | null }) {
  const t = useTranslations('web.auth.oauthError');
  const kind = oauthFailureOf(error);
  return (
    <AuthScreen
      icon={<CircleAlert aria-hidden className="size-10 text-warning" />}
      title={t(`${kind}.title`)}
      lede={t(`${kind}.lede`)}
    >
      {kind === 'notLinkable' ? (
        <ol className="grid list-decimal gap-2 pl-5 text-sm">
          <li>{t('notLinkable.step1')}</li>
          <li>{t('notLinkable.step2')}</li>
        </ol>
      ) : null}
      <Button asChild className="w-full">
        <Link
          href={
            kind === 'notLinkable'
              ? withRedirect(routes.signIn, routes.settingsAccount)
              : routes.signIn
          }
        >
          {t(kind === 'notLinkable' ? 'notLinkable.action' : 'retry')}
        </Link>
      </Button>
    </AuthScreen>
  );
}
