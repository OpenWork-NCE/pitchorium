'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Banner, Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { useCurrentMember } from './current-member';

/**
 * Banners of the account across the top of the member space, from the most serious (patterns.md):
 * suspension, terms to accept, email to verify, second factor required by a role. Read from
 * `GET /v1/me`; none blocks the navigation, the api decides on every call.
 */
export function AccountBanners() {
  const member = useCurrentMember();
  const t = useTranslations('web.banners');
  const [sent, setSent] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  async function resend() {
    setSent('sending');
    try {
      const { authClient } = await import('@/lib/auth/client');
      const result = await authClient.sendVerificationEmail({
        email: member.user.email,
        callbackURL: window.location.href,
      });
      setSent(result.error ? 'failed' : 'sent');
    } catch {
      setSent('failed');
    }
  }

  const settings = (label: string) => (
    <Button asChild size="sm" variant="outline">
      <Link href={routes.settings}>{label}</Link>
    </Button>
  );
  const needsSecondFactor =
    member.roles.some((role) => role === 'moderator' || role === 'admin') &&
    !member.user.twoFactorEnabled;

  return (
    <div data-account-banners="">
      {member.trust.suspended ? (
        <Banner tone="danger" action={settings(t('suspended.action'))}>
          {t('suspended.body')}
        </Banner>
      ) : null}
      {!member.legal.upToDate ? (
        <Banner tone="info" action={settings(t('legal.action'))}>
          {t('legal.body')}
        </Banner>
      ) : null}
      {!member.user.emailVerified ? (
        <Banner
          tone="warning"
          action={
            sent === 'sent' ? undefined : (
              <Button
                size="sm"
                variant="outline"
                loading={sent === 'sending'}
                loadingLabel={t('email.sending')}
                onClick={() => void resend()}
              >
                {t('email.action')}
              </Button>
            )
          }
        >
          <span>{t('email.body', { email: member.user.email })}</span>{' '}
          <span role="status">
            {sent === 'sent' ? t('email.sent') : sent === 'failed' ? t('email.failed') : null}
          </span>
        </Banner>
      ) : null}
      {needsSecondFactor ? (
        <Banner tone="info" action={settings(t('twoFactor.action'))}>
          {t('twoFactor.body')}
        </Banner>
      ) : null}
    </div>
  );
}
