import { discoveryControllerPage, discoveryControllerPublicPage } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { EmptyState, Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { DiscoverPage } from '@/features/discovery';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { resourceMetadata } from '@/lib/resources/metadata';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/discover'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('web.discover');
  const member = await getCurrentMember();
  const metadata = await resourceMetadata(
    asLocale(locale),
    routes.discover,
    { view: member ? 'member' : 'visitor', data: null },
    t('title'),
  );
  return { ...metadata, description: t('description') };
}

/**
 * « Découvrir » (§10.6), public and indexable, the same address in the member space (ADR 0101):
 * the sections of the api in wide grids, the suggested profiles of a member with their reason.
 */
export default async function Page({ params }: PageProps<'/[locale]/discover'>) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations('web.discover');
  configureServerApi();
  const member = await getCurrentMember();
  const signedIn = member !== null;
  const read = signedIn ? discoveryControllerPage : discoveryControllerPublicPage;
  const page = await read({ limit: 8 }, { cache: 'no-store' }).catch(() => null);
  return (
    <SingleColumnLayout>
      <div className="grid gap-10">
        <header className="grid max-w-prose gap-2">
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <Text tone="muted">{signedIn ? t('lede') : t('ledeVisitor')}</Text>
        </header>
        {page ? (
          <DiscoverPage sections={page.sections} signedIn={signedIn} />
        ) : (
          <EmptyState size="page" title={t('error')} description={t('errorBody')} />
        )}
      </div>
    </SingleColumnLayout>
  );
}
