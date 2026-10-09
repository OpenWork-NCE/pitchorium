'use client';

import type { ComboboxOption } from '@/components/ui';
import { routes } from '@/config/routes';
import { OnboardingFrame, useEnterProduct } from './onboarding-frame';
import { type ProfileStepInitial, ProfileStep } from './profile-step';

/** Last step, then the feed with the completion module at its top (§7.2). */
export function ProfileOnboardingStep({
  initial,
  countries,
}: {
  initial: ProfileStepInitial;
  countries: readonly ComboboxOption[];
}) {
  const enter = useEnterProduct();
  return (
    <OnboardingFrame step="profile">
      <ProfileStep initial={initial} countries={countries} onDone={() => enter(routes.feed)} />
    </OnboardingFrame>
  );
}
