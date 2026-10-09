import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';
import { getCurrentMember } from '@/lib/auth/session';

/** Entry of the onboarding: the terms first when they are not accepted, else the intention. */
export default async function Page({ params }: PageProps<'/[locale]/onboarding'>) {
  const [{ locale }, member] = await Promise.all([params, getCurrentMember()]);
  redirect(
    `/${locale}${member?.legal.upToDate ? routes.onboardingIntention : routes.onboardingTerms}`,
  );
}
