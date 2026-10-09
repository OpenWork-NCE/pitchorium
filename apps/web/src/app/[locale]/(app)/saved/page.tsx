import { postsControllerSaved } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Text } from '@/components/ui';
import { SavedPosts } from '@/features/content';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.saved');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The publications the member saved (§10.3), the first page read by the server. */
export default async function Page({ params }: PageProps<'/[locale]/saved'>) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations('web.saved');
  configureServerApi();
  const first = await postsControllerSaved({ limit: 20 }, { cache: 'no-store' }).catch(() => null);
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <div className="grid gap-1">
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <Text tone="muted">{t('description')}</Text>
        </div>
        <SavedPosts initial={first} />
      </div>
    </SingleColumnLayout>
  );
}
