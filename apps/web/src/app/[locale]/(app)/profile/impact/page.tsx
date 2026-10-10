import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Link, Text } from '@/components/ui';
import { routes } from '@/config/routes';
import { EntrepreneurAssessment } from '@/features/impact';
import { asLocale } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.impact.entrepreneur');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The self-declared impact of the entrepreneur facet of the member (§12), from their profile. */
export default async function Page({ params }: PageProps<'/[locale]/profile/impact'>) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations('web.impact.entrepreneur');
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Link href={routes.profile} variant="standalone" className="text-sm">
            {t('back')}
          </Link>
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <Text tone="muted">{t('description')}</Text>
          <p className="text-sm">
            <Link href={routes.impactMethodology} variant="standalone">
              {t('methodology')}
            </Link>
          </p>
        </div>
        <ScopedMessages scope="projectEditor">
          <EntrepreneurAssessment />
        </ScopedMessages>
      </div>
    </SingleColumnLayout>
  );
}
