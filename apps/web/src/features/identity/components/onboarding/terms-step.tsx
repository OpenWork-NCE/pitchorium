'use client';

import type { LegalVersionsDtoOutput } from '@pitchorium/api-client';
import { routes } from '@/config/routes';
import { useRouter } from '@/i18n/navigation';
import { LegalAcceptanceForm } from './legal-acceptance-form';
import { OnboardingFrame, useEnterProduct } from './onboarding-frame';

/**
 * Terms (§7.2, mandatory for every method). A member who signs in again after a change of the
 * terms returns to the page asked for; a new member goes on to the intention.
 */
export function TermsStep({
  versions,
  redirectTo,
}: {
  versions: LegalVersionsDtoOutput;
  redirectTo: string | null;
}) {
  const router = useRouter();
  const enter = useEnterProduct();
  return (
    <OnboardingFrame step="terms">
      <LegalAcceptanceForm
        versions={versions}
        onAccepted={() =>
          redirectTo ? enter(redirectTo) : router.push(routes.onboardingIntention)
        }
      />
    </OnboardingFrame>
  );
}
