import { meControllerProfile, profilesControllerReferenceData } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routes } from '@/config/routes';
import { ProfileOnboardingStep } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.onboarding.profile');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The countries are labelled here, on the server: their catalogue stays off the browser. */
export default async function Page({ params }: PageProps<'/[locale]/onboarding/profile'>) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const member = await getCurrentMember();
  if (!member?.legal.upToDate) redirect(`/${locale}${routes.onboardingTerms}`);
  configureServerApi();
  const [reference, own, t] = await Promise.all([
    profilesControllerReferenceData({ next: { revalidate: 3600 } }),
    meControllerProfile({ cache: 'no-store' }),
    getTranslations('reference'),
  ]);
  const countries = reference.countries
    .map(({ code, labelKey }) => ({
      value: code,
      label: t.has(labelKey as never) ? t(labelKey as never) : code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  return (
    <ProfileOnboardingStep
      countries={countries}
      initial={{
        displayName: member.profile.displayName,
        headline: member.profile.headline,
        countryCode: own.countryCode,
        avatarUrl: member.profile.avatarUrl,
        strength: member.profileStrength.percent,
      }}
    />
  );
}
