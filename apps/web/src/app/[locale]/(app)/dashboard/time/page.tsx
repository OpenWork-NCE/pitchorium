import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Link } from '@/components/ui';
import * as routes from '@/config/paths';
import { TimeLog } from '@/features/engagement';
import { asLocale } from '@/i18n/routing';
import { memberSupportedProjects } from '../read-supported';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.engagement.time');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The shared time log (§6.3): hours declared by the member and received for their projects. */
export default async function Page({ params }: PageProps<'/[locale]/dashboard/time'>) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations('web.engagement.time');
  const projects = await memberSupportedProjects();
  return (
    <SingleColumnLayout width="page">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Link href={routes.dashboard} variant="standalone" className="text-sm">
            {t('back')}
          </Link>
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <p className="text-muted">{t('description')}</p>
        </div>
        <TimeLog projects={projects} />
      </div>
    </SingleColumnLayout>
  );
}
