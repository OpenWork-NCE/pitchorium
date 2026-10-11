import { projectsControllerPublicShowcase } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Organization, WebSite, WithContext } from 'schema-dts';
import * as routes from '@/config/paths';
import { alternatesFor, localizedUrl } from '@/config/seo';
import { SITE_NAME, siteConfig } from '@/config/site';
import { HomePage } from '@/features/marketing';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getActiveLocales } from '@/lib/i18n/active-locales';
import { jsonLd } from '@/lib/seo/json-ld';

const FEATURED = 3;

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('web.marketing.home');
  const { locales } = await getActiveLocales();
  return {
    description: t('description'),
    alternates: alternatesFor(asLocale(locale), '/', locales),
  };
}

/** The projects featured by the api, or its most recent ones; none when it cannot answer. */
async function homeProjects() {
  configureServerApi();
  const read = (featured: boolean) =>
    projectsControllerPublicShowcase(
      { limit: FEATURED, ...(featured ? { featured: 'true' as const } : {}) },
      { next: { revalidate: 300 } },
    ).then((page) => page.items);
  const featured = await read(true).catch(() => []);
  return featured.length > 0 ? featured : read(false).catch(() => []);
}

/** Editorial home page (ADR 0156), with the structured data of Pitchorium and of its site. */
export default async function Page({ params }: PageProps<'/[locale]'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations('web.marketing.home');
  const projects = await homeProjects();
  const home = localizedUrl(locale, '/');
  const organization: WithContext<Organization> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: siteConfig.url,
    logo: new URL('/brand/app-icon-dark-512.png', siteConfig.url).toString(),
    description: t('description'),
  };
  const website: WithContext<WebSite> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: home,
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${localizedUrl(locale, routes.search)}?q={search_term_string}`,
      // @ts-expect-error schema.org extension read by search engines (query-input).
      'query-input': 'required name=search_term_string',
    },
  };
  return (
    <>
      <HomePage projects={projects} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(organization) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(website) }} />
    </>
  );
}
