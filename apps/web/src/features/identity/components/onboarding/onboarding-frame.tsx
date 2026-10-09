'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Stepper } from '@/components/ui';
import { AuthScreen } from '../auth/auth-screen';

const STEPS = ['terms', 'intention', 'profile'] as const;
type Step = (typeof STEPS)[number];

/** Frame of a step: where the member is in the three steps, the question, the form. */
export function OnboardingFrame({ step, children }: { step: Step; children: ReactNode }) {
  const t = useTranslations('web.onboarding');
  return (
    <div className="grid gap-6">
      <Stepper
        label={t('progress')}
        current={STEPS.indexOf(step)}
        steps={STEPS.map((id) => ({ id, label: t(`steps.${id}`) }))}
      />
      <AuthScreen title={t(`${step}.title`)} lede={t(`${step}.lede`)}>
        {children}
      </AuthScreen>
    </div>
  );
}

/** Full navigation to the member space: its server components read the updated account. */
export function useEnterProduct() {
  const locale = useLocale();
  return (path: string) =>
    window.location.assign(
      new URL(path.startsWith(`/${locale}/`) ? path : `/${locale}${path}`, window.location.origin),
    );
}
