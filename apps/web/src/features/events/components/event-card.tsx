import type { EventCard as EventCardData } from '@pitchorium/contracts';
import { CalendarDays, MapPin, Video } from 'lucide-react';
import { getImageProps } from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge, Card, Text, VerifiedBadge } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';

/**
 * An event in a list (§14): its image in 16:9, its type, its title (the one link of the card),
 * its date and hour in its own zone, its city or « En ligne », its organizer and its seats.
 * Rendered by the server as by the browser.
 */
export function EventCard({
  event,
  headingLevel = 2,
}: {
  event: EventCardData;
  headingLevel?: 2 | 3;
}) {
  const t = useTranslations('web.events.card');
  const reference = useTranslations('reference');
  const format = useFormatter();
  const Title = `h${headingLevel}` as const;
  const organizer =
    event.organizer.kind === 'member'
      ? event.organizer.member.displayName
      : event.organizer.organization.name;
  return (
    <Card
      className="relative grid h-full content-start gap-0 overflow-hidden p-0"
      data-event-card={event.slug}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-surface-sunken">
        {event.imageUrl ? (
          // The props of next/image without its client component (ADR 0094); `alt` is in them.
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img
            {...getImageProps({
              src: event.imageUrl,
              alt: '',
              fill: true,
              sizes: '(min-width: 1024px) 400px, 100vw',
              className: 'object-cover',
            }).props}
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 bg-[url(/brand/overlay-mobile.svg)] bg-size-[160%_auto] bg-center bg-no-repeat opacity-60"
          />
        )}
      </div>
      <div className="grid gap-2 p-5">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{reference(`eventFormats.${event.format}`)}</Badge>
          {event.status === 'canceled' ? (
            <Badge tone="danger">{reference('eventStatuses.canceled')}</Badge>
          ) : event.status === 'draft' ? (
            <Badge>{reference('eventStatuses.draft')}</Badge>
          ) : event.full && event.status === 'published' ? (
            <Badge tone="warning">{t('full')}</Badge>
          ) : null}
        </div>
        <Title className="font-sans text-lg leading-snug font-semibold text-balance">
          <Link
            href={routes.event(event.slug)}
            className="link-underline-hover outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-focus"
          >
            {event.title}
          </Link>
        </Title>
        <Text size="sm" className="flex items-center gap-1.5">
          <CalendarDays aria-hidden className="size-4 shrink-0 text-muted" />
          {format.dateTime(new Date(event.startsAt), {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: event.timeZone,
          })}
        </Text>
        <Text size="sm" tone="muted" className="flex items-center gap-1.5">
          {event.city ? (
            <>
              <MapPin aria-hidden className="size-4 shrink-0" />
              {event.city}
            </>
          ) : (
            <>
              <Video aria-hidden className="size-4 shrink-0" />
              {reference('eventFormats.online')}
            </>
          )}
        </Text>
        <Text size="sm" tone="muted" className="inline-flex items-center gap-1">
          {t('by', { name: organizer })}
          {event.organizer.kind === 'organization' && event.organizer.organization.verified ? (
            <VerifiedBadge />
          ) : null}
        </Text>
      </div>
    </Card>
  );
}
