import { notificationsControllerPreferences } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { NotificationSettings } from '@/features/notifications';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('notifications'), robots: { index: false, follow: false } };
}

/** « Notifications »: each type by channel, the rhythm of the emails and when digests leave. */
export default async function Page({ params }: PageProps<'/[locale]/settings/notifications'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const preferences = await notificationsControllerPreferences({
    cache: 'no-store',
  });
  return (
    <div className="grid gap-6 *:min-w-0">
      <ScopedMessages scope="notifications">
        <NotificationSettings initial={preferences} />
      </ScopedMessages>
    </div>
  );
}
