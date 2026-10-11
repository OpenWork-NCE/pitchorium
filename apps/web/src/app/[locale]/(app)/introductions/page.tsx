import { messagingControllerListIntroductions } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { Heading, Text } from '@/components/ui';
import { IntroductionsBox } from '@/features/messaging';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.messaging.introductions');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The introductions of the member (§10.4): those to answer first, then the others. */
export default async function Page({ params }: PageProps<'/[locale]/introductions'>) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations('web.messaging.introductions');
  configureServerApi();
  const first = await messagingControllerListIntroductions(
    { limit: 20 },
    { cache: 'no-store' },
  ).catch(() => null);
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <div className="grid gap-1">
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <Text tone="muted">{t('description')}</Text>
        </div>
        <ScopedMessages scope="messaging">
          <IntroductionsBox initial={first} />
        </ScopedMessages>
      </div>
    </SingleColumnLayout>
  );
}
