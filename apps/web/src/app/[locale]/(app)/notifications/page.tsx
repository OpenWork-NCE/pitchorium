import { notificationsControllerList } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { UrlStateProvider } from '@/components/layout/url-state';
import { Heading } from '@/components/ui';
import { NotificationsPage } from '@/features/notifications';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.nav');
  return { title: t('notifications'), robots: { index: false, follow: false } };
}

/** The notifications of the member (§10.5), the first page read by the server. */
export default async function Page({ params }: PageProps<'/[locale]/notifications'>) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations('web.nav');
  configureServerApi();
  const first = await notificationsControllerList({ limit: 20 }, { cache: 'no-store' }).catch(
    () => null,
  );
  return (
    <SingleColumnLayout width="prose">
      <div className="grid grid-cols-1 gap-6">
        <Heading level={1} size="page">
          {t('notifications')}
        </Heading>
        <ScopedMessages scope="notifications">
          <UrlStateProvider>
            <NotificationsPage initial={first} />
          </UrlStateProvider>
        </ScopedMessages>
      </div>
    </SingleColumnLayout>
  );
}
