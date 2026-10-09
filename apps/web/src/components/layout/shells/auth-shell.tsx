import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { InteractiveRuntime } from '../interactive-runtime';
import { AuthFrame } from './auth-frame';

/**
 * Sign-in, sign-up, verification, reset and onboarding (AuthFrame): the split screen of the
 * brand and the form, the language and the theme always at hand.
 */
export async function AuthShell({ children }: { children: ReactNode }) {
  const [a11y, t] = await Promise.all([
    getTranslations('web.a11y'),
    getTranslations('web.auth.brand'),
  ]);
  return (
    <InteractiveRuntime scope="auth">
      <AuthFrame
        texts={{
          homeLink: a11y('homeLink'),
          label: t('label'),
          kicker: t('kicker'),
          promise: t('promise'),
          lede: t('lede'),
        }}
      >
        {children}
      </AuthFrame>
    </InteractiveRuntime>
  );
}
