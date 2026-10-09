import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routes } from '@/config/routes';
import { IntentionOnboardingStep } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { getCurrentMember } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.onboarding.intention');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/onboarding/intention'>) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const member = await getCurrentMember();
  if (!member?.legal.upToDate) redirect(`/${locale}${routes.onboardingTerms}`);
  return <IntentionOnboardingStep initial={member.profile.intention} />;
}
