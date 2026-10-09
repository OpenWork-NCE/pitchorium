import { meControllerProfile, profileViewsControllerSettings } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NetworkPrivacySettings } from '@/features/network';
import { VisibilitySettings } from '@/features/profiles';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('privacy'), robots: { index: false, follow: false } };
}

/** « Confidentialité et réseau »: who sees the profile, private visits, blocked members. */
export default async function Page({ params }: PageProps<'/[locale]/settings/privacy'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const [profile, network] = await Promise.all([
    meControllerProfile({ cache: 'no-store' }),
    profileViewsControllerSettings({ cache: 'no-store' }),
  ]);
  return (
    <div className="grid gap-6 *:min-w-0">
      <VisibilitySettings initial={profile.visibility} />
      <NetworkPrivacySettings initial={network} />
    </div>
  );
}
