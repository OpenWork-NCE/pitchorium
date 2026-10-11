import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTimeZone, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import * as routes from '@/config/paths';
import { siteConfig } from '@/config/site';
import { EventPage, eventJsonLd } from '@/features/events';
import { asLocale } from '@/i18n/routing';
import { DEFAULT_TIME_ZONE } from '@/lib/i18n/time-zone';
import { publicEnv } from '@/lib/public-env';
import { resourceMetadata } from '@/lib/resources/metadata';
import { jsonLd } from '@/lib/seo/json-ld';
import { readEvent } from './read-event';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/events/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const resource = await readEvent(slug);
  const metadata = await resourceMetadata(
    asLocale(locale),
    routes.event(resource?.data.slug ?? slug),
    resource,
    resource?.data.title,
  );
  // A draft (its organizers only) is never indexed, whatever the view.
  if (resource?.data.status === 'draft')
    return { ...metadata, robots: { index: false, follow: false } };
  const description = resource?.data.description
    .replace(/[#*_>`[\]()]/g, '')
    .trim()
    .slice(0, 160);
  return description ? { ...metadata, description } : metadata;
}

/**
 * Page of an event (§14, ADR 0101): one address; the public view, indexable with its structured
 * data `Event` and its share image; the member view with the registration and the participants;
 * a draft for its organizers only, never indexed; 404 otherwise. A former slug redirects.
 */
export default async function Page({ params }: PageProps<'/[locale]/events/[slug]'>) {
  const { locale: raw, slug } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const resource = await readEvent(slug);
  if (!resource) notFound();
  const event = resource.data;
  if (event.slug !== slug) permanentRedirect(`/${locale}${routes.event(event.slug)}`);
  const url = new URL(`/${locale}${routes.event(event.slug)}`, siteConfig.url).toString();
  const zone = await getTimeZone();
  const organizerPath =
    event.organizer.kind === 'member'
      ? routes.member(event.organizer.member.handle)
      : routes.organization(event.organizer.organization.slug);
  const icsUrl =
    resource.view === 'member'
      ? `${publicEnv.apiUrl}/v1/events/${event.id}/ics`
      : `${publicEnv.apiUrl}/v1/public/events/${event.slug}/ics`;
  return (
    <SingleColumnLayout>
      {resource.view === 'visitor' ? (
        <script
          type="application/ld+json"
          // Structured data of the public view (FRONT 7): `<` escaped by `jsonLd`.
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              eventJsonLd(event, {
                url,
                siteUrl: siteConfig.url,
                organizerUrl: new URL(`/${locale}${organizerPath}`, siteConfig.url).toString(),
              }),
            ),
          }}
        />
      ) : null}
      <EventPage
        event={event}
        view={resource.view}
        readerTimeZone={zone === DEFAULT_TIME_ZONE ? null : zone}
        pageUrl={url}
        icsUrl={icsUrl}
      />
    </SingleColumnLayout>
  );
}
