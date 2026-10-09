'use client';

import type { OAuthProvider } from '@pitchorium/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, Button, DescriptionList, Skeleton } from '@/components/ui';
import { routes } from '@/config/routes';
import { authCall, useAuthFailureMessage } from '../../lib/auth-call';
import { absoluteUrl } from '../auth/targets';
import { useCurrentMember } from '../current-member';
import { SettingsSection } from './settings-section';

interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
}

const ACCOUNTS_KEY = ['identity', 'accounts'] as const;

/**
 * Account (§7): the email, the sign-in methods linked to it (link one more, unlink one; the last
 * one cannot be removed, and the reason is said), the versions of the terms accepted.
 */
export function AccountSettings({ providers }: { providers: readonly OAuthProvider[] }) {
  const t = useTranslations('web.settings.account');
  const member = useCurrentMember();
  return (
    <div className="grid gap-6">
      <SettingsSection id="email" title={t('email.title')}>
        <DescriptionList
          items={[
            {
              term: t('email.address'),
              description: (
                <span className="inline-flex flex-wrap items-center gap-2">
                  {member.user.email}
                  <Badge tone={member.user.emailVerified ? 'success' : 'warning'}>
                    {t(member.user.emailVerified ? 'email.verified' : 'email.unverified')}
                  </Badge>
                </span>
              ),
            },
          ]}
        />
      </SettingsSection>
      <LinkedAccounts providers={providers} />
      <SettingsSection id="legal" title={t('legal.title')} description={t('legal.description')}>
        <DescriptionList
          items={[
            {
              term: t('legal.terms'),
              description: member.legal.acceptedTermsVersion ?? t('legal.none'),
            },
            {
              term: t('legal.privacy'),
              description: member.legal.acceptedPrivacyVersion ?? t('legal.none'),
            },
          ]}
        />
      </SettingsSection>
    </div>
  );
}

function LinkedAccounts({ providers }: { providers: readonly OAuthProvider[] }) {
  const t = useTranslations('web.settings.account.methods');
  const names = useTranslations('reference.signInProviders');
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accounts = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async () => {
      const { authClient } = await import('@/lib/auth/client');
      const result = await authClient.listAccounts();
      if (result.error) throw new Error(result.error.code ?? 'accounts');
      return result.data;
    },
  });
  const linked = accounts.data ?? [];
  const last = linked.length <= 1;

  async function link(provider: OAuthProvider) {
    setPending(provider);
    setError(null);
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.linkSocial({
        provider,
        callbackURL: absoluteUrl(locale, routes.settingsAccount),
        errorCallbackURL: absoluteUrl(locale, routes.authError),
        fetchOptions,
      }),
    );
    if (!outcome.ok) {
      setPending(null);
      setError(message(outcome.failure));
    }
  }

  async function unlink(account: LinkedAccount) {
    setPending(account.providerId);
    setError(null);
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.unlinkAccount({ accountId: account.id, fetchOptions }),
    );
    setPending(null);
    if (!outcome.ok) setError(message(outcome.failure));
    await queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
  }

  const label = (providerId: string) =>
    names.has(providerId as never) ? names(providerId as never) : providerId;

  return (
    <SettingsSection id="methods" title={t('title')} description={t('description')}>
      {accounts.isPending ? (
        <Skeleton className="h-24" />
      ) : (
        <ul className="grid gap-2">
          {linked.map((account) => (
            <li
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <span className="font-medium">{label(account.providerId)}</span>
              {last ? (
                <span className="text-sm text-muted">{t('lastMethodShort')}</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  loading={pending === account.providerId}
                  loadingLabel={t('unlinking')}
                  onClick={() => void unlink(account)}
                >
                  {t('unlink', { provider: label(account.providerId) })}
                </Button>
              )}
            </li>
          ))}
          {providers
            .filter((provider) => !linked.some((account) => account.providerId === provider))
            .map((provider) => (
              <li
                key={provider}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border p-3"
              >
                <span className="text-muted">{label(provider)}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={pending === provider}
                  loadingLabel={t('linking')}
                  onClick={() => void link(provider)}
                >
                  {t('link', { provider: label(provider) })}
                </Button>
              </li>
            ))}
        </ul>
      )}
      {last && linked.length === 1 ? <p className="text-sm text-muted">{t('lastMethod')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </SettingsSection>
  );
}
