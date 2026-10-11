import {
  messagingControllerSettings,
  notificationsControllerPreferences,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { MessagingSettings } from '@/features/messaging';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('messaging'), robots: { index: false, follow: false } };
}

/** « Messagerie »: who may write to the member, and the copy of unread messages by email. */
export default async function Page({ params }: PageProps<'/[locale]/settings/messaging'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const [settings, preferences] = await Promise.all([
    messagingControllerSettings({ cache: 'no-store' }),
    notificationsControllerPreferences({ cache: 'no-store' }),
  ]);
  const message = preferences.types.find((preference) => preference.type === 'message');
  return (
    <div className="grid gap-6 *:min-w-0">
      <ScopedMessages scope="messaging">
        <MessagingSettings initial={settings} unreadCopy={message?.channels.email ?? false} />
      </ScopedMessages>
    </div>
  );
}
