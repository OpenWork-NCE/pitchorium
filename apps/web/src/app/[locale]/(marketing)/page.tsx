import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Organization, WithContext } from 'schema-dts';
import { Container } from '@/components/layout/container';
import { MOTIF } from '@/components/layout/shells/parts';
import { SplitHeading } from '@/components/motion/split-heading';
import { alternatesFor } from '@/config/seo';
import { SITE_NAME, siteConfig } from '@/config/site';
import { Foundations } from '@/features/marketing';
import { asLocale } from '@/i18n/routing';
import { getActiveLocales } from '@/lib/i18n/active-locales';
import { cn } from '@/lib/cn';
import { jsonLd } from '@/lib/seo/json-ld';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const { locales } = await getActiveLocales();
  return { alternates: alternatesFor(asLocale(locale), '/', locales) };
}

/** Provisional home page (PROMPT FRONT 0): proves the chain until the editorial home exists. */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const t = await getTranslations('web.home');
  const { locales } = await getActiveLocales();

  const organization: WithContext<Organization> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: siteConfig.url,
    logo: new URL('/brand/app-icon-dark-512.png', siteConfig.url).toString(),
  };

  return (
    <>
      <section className={cn('relative overflow-hidden border-b border-border', MOTIF)}>
        <Container className="py-20 md:py-32">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">{t('eyebrow')}</p>
          <h1 className="mt-6 max-w-4xl text-4xl md:text-5xl">{t('title')}</h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">{t('lede')}</p>
        </Container>
      </section>
      <section aria-labelledby="foundations" className="py-20 md:py-28">
        <Container>
          <SplitHeading id="foundations" className="text-3xl md:text-4xl">
            {t('foundations')}
          </SplitHeading>
          <Foundations activeLocales={locales} />
        </Container>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(organization) }}
      />
    </>
  );
}
