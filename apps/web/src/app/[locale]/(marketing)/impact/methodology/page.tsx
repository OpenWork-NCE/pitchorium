import { methodologiesControllerPublished } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/layout/container';
import { Heading, Text } from '@/components/ui';
import { routes } from '@/config/routes';
import { alternatesFor } from '@/config/seo';
import { MethodologyPage, MethodologyUnavailable } from '@/features/impact';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getActiveLocales } from '@/lib/i18n/active-locales';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/impact/methodology'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('web.impact.methodology');
  const { locales } = await getActiveLocales();
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor(asLocale(locale), routes.impactMethodology, locales),
  };
}

/**
 * The methodology of the self-declared impact in force (§12), public and indexable: what every
 * impact badge links to. Without a published one, the page says so.
 */
export default async function Page({ params }: PageProps<'/[locale]/impact/methodology'>) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations('web.impact.methodology');
  configureServerApi();
  const methodology = await methodologiesControllerPublished({ cache: 'no-store' }).catch(
    () => null,
  );
  return (
    <Container className="grid max-w-4xl gap-8 py-12 md:py-16">
      <header className="grid max-w-prose gap-3">
        <Heading level={1} size="display">
          {t('title')}
        </Heading>
        <Text size="lg" tone="muted">
          {t('lede')}
        </Text>
      </header>
      {methodology ? <MethodologyPage methodology={methodology} /> : <MethodologyUnavailable />}
    </Container>
  );
}
