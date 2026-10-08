import { eventsControllerBySlug, eventsControllerForPublic } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cache } from 'react';
import { ResourcePlaceholder } from '@/components/layout/resource-placeholder';
import { routes } from '@/config/routes';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { resourceMetadata } from '@/lib/resources/metadata';
import { readResource } from '@/lib/resources/view';

/** The event as the reader may see it, read once per request. */
const read = cache(async (slug: string) => {
  configureServerApi();
  const member = await getCurrentMember();
  return readResource({
    signedIn: member !== null,
    forMember: () => eventsControllerBySlug(slug, { cache: 'no-store' }),
    forVisitor: () => eventsControllerForPublic(slug, { cache: 'no-store' }),
  });
});

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/events/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const resource = await read(slug);
  return resourceMetadata(asLocale(locale), routes.event(slug), resource, resource?.data.title);
}

/**
 * Page of an event, one address for visitors and members (ADR 0101): an event for members only
 * answers 404 to a visitor. Its content arrives with the events.
 */
export default async function Page({ params }: PageProps<'/[locale]/events/[slug]'>) {
  const { locale, slug } = await params;
  setRequestLocale(asLocale(locale));
  const resource = await read(slug);
  if (!resource) notFound();
  const t = await getTranslations('web.resources');
  return <ResourcePlaceholder kind={t('event')} name={resource.data.title} />;
}
