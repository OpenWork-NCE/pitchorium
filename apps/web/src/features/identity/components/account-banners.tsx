'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Banner, Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link, usePathname } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { useAccess } from '@/features/access';
import { useCurrentMember } from './current-member';

/**
 * The second factor a privileged role requires, as the api tells it for the moderation console
 * (`GET /v1/me/prerequisites/trust.moderation.read`): no rule of the web app (ADR 0109).
 */
function SecondFactorBanner({ action }: { action: (label: string, href: string) => ReactNode }) {
  const t = useTranslations('web.banners');
  const access = useAccess('trust.moderation.read');
  if (!access.missing.includes('two_factor')) return null;
  return (
    <Banner tone="info" action={action(t('twoFactor.action'), routes.settingsSecurity)}>
      {t('twoFactor.body')}
    </Banner>
  );
}

/**
 * Banners of the account across the top of the member space, from the most serious (patterns.md):
 * suspension (to the notice of the decision, among the notifications), terms to accept (to the
 * step of the onboarding, then back here), email to verify (resend in place), second factor
 * required by a role. Read from `GET /v1/me` and, for the second factor, from the prerequisites
 * the api gives; none blocks the navigation, the api decides on every call.
 */
export function AccountBanners() {
  const member = useCurrentMember();
  const t = useTranslations('web.banners');
  const locale = useLocale();
  const pathname = usePathname();
  const [sent, setSent] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  async function resend() {
    setSent('sending');
    try {
      const { authClient } = await import('@/lib/auth/client');
      const result = await authClient.sendVerificationEmail({
        email: member.user.email,
        callbackURL: `${window.location.origin}/${locale}${routes.emailVerified}`,
      });
      setSent(result.error ? 'failed' : 'sent');
    } catch {
      setSent('failed');
    }
  }

  const action = (label: string, href: string) => (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>{label}</Link>
    </Button>
  );
  // Only a privileged role may lack a second factor that its console requires: the api says it.
  const privileged = member.roles.some((role) => role !== 'member');

  return (
    <div data-account-banners="">
      {member.trust.suspended ? (
        // The notice and its appeal arrive by email and in the notifications; the page of the
        // decision and of the appeal comes with the moderation (PROMPT FRONT 8).
        <Banner tone="danger" action={action(t('suspended.action'), routes.notifications)}>
          {t('suspended.body')}
        </Banner>
      ) : null}
      {!member.legal.upToDate ? (
        <Banner
          tone="info"
          action={action(
            t('legal.action'),
            withRedirect(routes.onboardingTerms, `/${locale}${pathname}`),
          )}
        >
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
      {privileged ? <SecondFactorBanner action={action} /> : null}
    </div>
  );
}
