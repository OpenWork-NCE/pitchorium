import type { EventCard } from '@pitchorium/contracts';
import { CalendarDays, MapPin, Video } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Avatar, Card } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';

/**
 * An event published by a member or an organisation the reader follows (FRONT 7): a simple card,
 * its title linked to its page, its date and hour in its own zone, its city or « En ligne ». The
 * registration is on the page of the event.
 */
export function EventFeedCard({ event }: { event: EventCard }) {
  const t = useTranslations('web.feed');
  const format = useFormatter();
  const organizer =
    event.organizer.kind === 'member'
      ? { name: event.organizer.member.displayName, src: event.organizer.member.avatarUrl }
      : { name: event.organizer.organization.name, src: event.organizer.organization.logoUrl };
  return (
    <Card padding="none" className="grid gap-3 p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <CalendarDays aria-hidden className="size-4" />
        {t('eventLabel')}
      </p>
      <header className="flex items-start gap-3">
        <Avatar
          name={organizer.name}
          src={organizer.src}
          shape={event.organizer.kind === 'organization' ? 'square' : 'circle'}
          decorative
        />
        <div className="grid min-w-0 gap-0.5">
          <p className="font-semibold text-pretty">
            <Link href={routes.event(event.slug)} className="link-underline-hover text-foreground">
              {event.title}
            </Link>
          </p>
          <p className="text-xs text-muted">{t('eventBy', { name: organizer.name })}</p>
        </div>
      </header>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden className="size-4 text-muted" />
          {format.dateTime(new Date(event.startsAt), {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: event.timeZone,
          })}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          {event.city ? (
            <MapPin aria-hidden className="size-4" />
          ) : (
            <Video aria-hidden className="size-4" />
          )}
          {event.city ?? t('eventOnline')}
        </span>
      </p>
    </Card>
  );
}
