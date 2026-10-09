'use client';

import type { AuthConfigurationDtoOutput } from '@pitchorium/api-client';
import { gsap } from 'gsap';
import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { AuthScreen } from './auth-screen';
import { EmailStep } from './magic-link-screen';
import { OAuthButtons } from './oauth-buttons';

/**
 * One entry for every method (§7.2, step 1): the providers the api enables, then « Continuer avec
 * un email », of the same weight, which leads to the email step (a link by email by default, a
 * password on request). Signing in and creating an account start here; no role is asked. Without
 * any provider, the email step is the entry itself.
 */
export function SignInScreen({
  config,
  redirectTo,
}: {
  config: AuthConfigurationDtoOutput;
  redirectTo: string | null;
}) {
  const t = useTranslations('web.auth.signIn');
  if (config.oauthProviders.length === 0) {
    return <EmailStep config={config} redirectTo={redirectTo} entry />;
  }
  return (
    <AuthScreen title={t('title')} lede={t('lede')}>
      {/* Injected regression (bundle budget): GSAP in the first load of the sign-in page. */}
      <div className="grid gap-3" data-engine={gsap.version}>
        <OAuthButtons providers={config.oauthProviders} redirectTo={redirectTo} />
        <Button asChild variant="outline" size="lg" className="w-full justify-center gap-3">
          <Link href={withRedirect(routes.magicLink, redirectTo)}>
            <Mail aria-hidden className="size-5" />
            {t('continueWithEmail')}
          </Link>
        </Button>
      </div>
    </AuthScreen>
  );
}
