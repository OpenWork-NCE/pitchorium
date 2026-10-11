import {
  discoveryControllerPublicSection,
  discoveryControllerSection,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Breadcrumbs, Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import {
  DISCOVER_SECTIONS,
  type DiscoverSection,
  DiscoverSectionGrid,
  ResultsMore,
} from '@/features/discovery';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { resourceMetadata } from '@/lib/resources/metadata';

const isSection = (value: string): value is DiscoverSection =>
  (DISCOVER_SECTIONS as readonly string[]).includes(value);

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/discover/[section]'>): Promise<Metadata> {
  const { locale, section } = await params;
  if (!isSection(section)) return {};
  const t = await getTranslations('web.discover');
  const member = await getCurrentMember();
  return resourceMetadata(
    asLocale(locale),
    routes.discoverSection(section),
    { view: member ? 'member' : 'visitor', data: null },
    t(`sections.${section}.title`),
  );
}

/**
 * A section of « Découvrir » on its own page (§10.6): its first page rendered by the server, the
 * next ones on demand. The suggested profiles are a member's only: 404 for a visitor.
 */
export default async function Page({ params }: PageProps<'/[locale]/discover/[section]'>) {
  const { locale, section } = await params;
  setRequestLocale(asLocale(locale));
  if (!isSection(section)) notFound();
  configureServerApi();
  const member = await getCurrentMember();
  const signedIn = member !== null;
  if (!signedIn && section === 'suggested_profiles') notFound();
  const t = await getTranslations('web.discover');
  const read = signedIn ? discoveryControllerSection : discoveryControllerPublicSection;
  const page = await read(section, { limit: 12 }, { cache: 'no-store' }).catch(() => null);
  if (!page) notFound();
  return (
    <SingleColumnLayout>
      <div className="grid gap-8">
        <Breadcrumbs
          items={[
            { label: t('title'), href: routes.discover },
            { label: t(`sections.${section}.title`) },
          ]}
        />
        <header className="grid max-w-prose gap-2">
          <Heading level={1} size="page">
            {t(`sections.${section}.title`)}
          </Heading>
          <Text tone="muted">{t(`sections.${section}.description`)}</Text>
        </header>
        <DiscoverSectionGrid page={page} signedIn={signedIn} full />
        <ResultsMore
          source={{ kind: 'section', section }}
          cursor={page.nextCursor}
          signedIn={signedIn}
          shown={page.items.length}
        />
      </div>
    </SingleColumnLayout>
  );
}
