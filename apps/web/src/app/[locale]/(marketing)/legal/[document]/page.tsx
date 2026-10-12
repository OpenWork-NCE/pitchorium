import { accountControllerCurrent } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { Flag } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button, Callout } from '@/components/ui';
import * as routes from '@/config/paths';
import { alternatesFor } from '@/config/seo';
import { isLegalDocument, LegalPage, loadLegalDocument } from '@/features/marketing';
import { Link } from '@/i18n/navigation';
import { asLocale } from '@/i18n/routing';
import { configureServerApi, sharedRead } from '@/lib/api/server';
import { getActiveLocales } from '@/lib/i18n/active-locales';

type Props = PageProps<'/[locale]/legal/[document]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, document } = await params;
  if (!isLegalDocument(document)) return {};
  const t = await getTranslations('web.marketing');
  const { locales } = await getActiveLocales();
  const title = t(`legalNames.${document}`);
  return {
    title,
    description: t('legal.description', { title }),
    alternates: alternatesFor(asLocale(locale), routes.legal(document), locales),
  };
}

/**
 * A legal page (ADR 0157), rendered from its versioned Markdown, with the legal versions in
 * force read from the api: the ones a member accepts at the onboarding.
 */
export default async function Page({ params }: Props) {
  const { locale: raw, document } = await params;
  if (!isLegalDocument(document)) notFound();
  const locale = asLocale(raw);
  setRequestLocale(locale);
  configureServerApi();
  const [markdown, versions, t] = await Promise.all([
    loadLegalDocument(document, locale),
    accountControllerCurrent(sharedRead(300)).catch(() => null),
    getTranslations('web.trust.notice'),
  ]);
  // « Signalement et point de contact »: the notice of illegal content without an account (§13).
  const action =
    document === 'reporting' ? (
      <Callout icon={<Flag />} title={t('title')}>
        <span className="grid gap-3">
          <span>{t('lede')}</span>
          <Button asChild className="justify-self-start">
            <Link href={routes.report}>{t('title')}</Link>
          </Button>
        </span>
      </Callout>
    ) : undefined;
  return <LegalPage document={markdown} versions={versions} action={action} />;
}
