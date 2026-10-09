'use client';

import type { Intention } from '@pitchorium/contracts';
import { routes } from '@/config/routes';
import { useRouter } from '@/i18n/navigation';
import { IntentionStep } from './intention-step';
import { OnboardingFrame } from './onboarding-frame';

export function IntentionOnboardingStep({ initial }: { initial: Intention | null }) {
  const router = useRouter();
  return (
    <OnboardingFrame step="intention">
      <IntentionStep initial={initial} onDone={() => router.push(routes.onboardingProfile)} />
    </OnboardingFrame>
  );
}
