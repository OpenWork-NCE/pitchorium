import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Breadcrumbs, Heading } from '@/components/ui';
import * as routes from '@/config/paths';
import { LazyEventForm } from '@/features/events';
import { asLocale } from '@/i18n/routing';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';
import { readEvent } from '../read-event';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.events.form');
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

/** Edition of an event by its organizers (the api says who manages it); 404 for anyone else. */
export default async function Page({ params }: PageProps<'/[locale]/events/[slug]/edit'>) {
  const { locale: raw, slug } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  if (!(await getCurrentMember())) {
    redirect(withRedirect(`/${locale}${routes.signIn}`, `/${locale}${routes.eventEdit(slug)}`));
  }
  const resource = await readEvent(slug);
  if (!resource || resource.data.viewer?.canManage !== true) notFound();
  const t = await getTranslations('web.events.form');
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <Breadcrumbs
          items={[
            { label: resource.data.title, href: routes.event(resource.data.slug) },
            { label: t('editTitle') },
          ]}
        />
        <Heading level={1} size="page">
          {t('editTitle')}
        </Heading>
        <LazyEventForm event={resource.data} />
      </div>
    </SingleColumnLayout>
  );
}
