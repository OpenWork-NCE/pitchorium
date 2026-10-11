import type { EventView } from '@pitchorium/contracts';
import {
  CalendarDays,
  CalendarPlus,
  Download,
  ExternalLink,
  Globe,
  Languages,
  MapPin,
  Users,
  Video,
} from 'lucide-react';
import { getImageProps } from 'next/image';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Heading,
  MarkdownContent,
  Text,
  VerifiedBadge,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { eventTimes } from '@/lib/format/event-times';
import { countryName } from '@/lib/format/countries';
import { googleCalendarUrl, mapUrl, placeText } from '../lib/calendar-links';
import { seatsLeft } from '../lib/registration';
import { LazyAttendees, LazyEventManage, LazyRegistration } from './lazy-islands';

interface EventPageProps {
  event: EventView;
  view: 'visitor' | 'member';
  /** The zone of the reader (preferences or browser), null while unknown. */
  readerTimeZone: string | null;
  /** Absolute address of the page, for the calendars. */
  pageUrl: string;
  /** The ICS file of the event on the api (the member's carries the link of a registered member). */
  icsUrl: string;
}

/**
 * The page of an event (§14, ADR 0069): image, title, organizer and their badge, type, the hours
 * in the zone of the event and in the reader's when it differs (ADR 0151), place with a plain link
 * to a map, language, sectors, seats; the link of an online event for the registered only;
 * registration, waiting list and its position; the participants as the api shows them; the
 * calendars without any third-party script. Rendered by the server, its interactive parts are
 * islands loaded for a member only. A visitor's view reveals its sections as they come (D4).
 */
export async function EventPage({ event, view, readerTimeZone, pageUrl, icsUrl }: EventPageProps) {
  const t = await getTranslations('web.events.page');
  const reference = await getTranslations('reference');
  const locale = await getLocale();
  const format = await getFormatter();
  const times = eventTimes(event.startsAt, event.endsAt, event.timeZone, readerTimeZone, locale);
  const left = seatsLeft(event.capacity, event.registeredCount);
  const manager = event.viewer?.canManage === true;
  const organizer =
    event.organizer.kind === 'member' ? (
      <span className="inline-flex items-center gap-2">
        <Avatar
          name={event.organizer.member.displayName}
          src={event.organizer.member.avatarUrl}
          size="sm"
          decorative
        />
        <Link
          href={routes.member(event.organizer.member.handle)}
          className="link-underline-hover font-medium"
        >
          {event.organizer.member.displayName}
        </Link>
      </span>
    ) : (
      <span className="inline-flex items-center gap-2">
        <Avatar
          name={event.organizer.organization.name}
          src={event.organizer.organization.logoUrl}
          size="sm"
          shape="square"
          decorative
        />
        <Link
          href={routes.organization(event.organizer.organization.slug)}
          className="link-underline-hover font-medium"
        >
          {event.organizer.organization.name}
        </Link>
        {event.organizer.organization.verified ? <VerifiedBadge /> : null}
      </span>
    );
  const Section = view === 'visitor' ? Reveal : 'div';
  const sectors = event.sectorCodes.map((code) =>
    reference.has(`sectorsShort.${code}` as never)
      ? reference(`sectorsShort.${code}` as never)
      : reference(`sectors.${code}` as never),
  );

  return (
    <article className="grid gap-8" data-event-status={event.status}>
      {event.status === 'canceled' ? (
        <Alert tone="danger" title={t('canceled')}>
          {event.cancelReason
            ? t('canceledReason', { reason: event.cancelReason })
            : t('canceledBody')}
        </Alert>
      ) : null}
      {event.status === 'draft' ? <Alert tone="info">{t('draft')}</Alert> : null}
      <header className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-cover-placeholder">
          {event.imageUrl ? (
            // The props of next/image without its client component (ADR 0094); `alt` is in them.
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img
              {...getImageProps({
                src: event.imageUrl,
                alt: event.imageAlt ?? '',
                fill: true,
                priority: true,
                sizes: '(min-width: 1024px) 720px, 100vw',
                className: 'object-cover',
              }).props}
            />
          ) : (
            <span
              aria-hidden
              className="absolute inset-0 bg-[url(/brand/overlay-desktop.svg)] bg-cover bg-center dark:brightness-[2.6]"
            />
          )}
        </div>
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{reference(`eventFormats.${event.format}`)}</Badge>
            {event.status !== 'published' ? (
              <Badge tone={event.status === 'canceled' ? 'danger' : 'neutral'}>
                {reference(`eventStatuses.${event.status}`)}
              </Badge>
            ) : null}
          </div>
          <Heading level={1} size="page" className="text-balance">
            {event.title}
          </Heading>
          <Text size="sm" tone="muted" className="flex flex-wrap items-center gap-2">
            {t('organizedBy')} {organizer}
          </Text>
          <div className="grid gap-1" data-event-times="">
            <p className="flex items-start gap-2 font-medium">
              <CalendarDays aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
              <span>
                <span className="first-letter:uppercase">{times.date}</span>
                <br />
                {t('timeIn', { time: times.time, city: times.city })}
                {times.local ? (
                  <>
                    {', '}
                    <span data-local-time="">{t('timeLocal', { time: times.local })}</span>
                  </>
                ) : null}
              </span>
            </p>
          </div>
          <div className="grid gap-3" data-registration="">
            {view === 'member' ? (
              <LazyRegistration
                eventId={event.id}
                status={event.status}
                startsAt={event.startsAt}
                full={event.full}
                viewer={event.viewer}
              />
            ) : event.status === 'published' ? (
              <Button asChild>
                <Link href={withRedirect(routes.signIn, routes.event(event.slug))}>
                  {t('signInToRegister')}
                </Link>
              </Button>
            ) : null}
            <Text size="sm" tone="muted" className="tabular-nums">
              {left === null
                ? t('seatsUnlimited', { count: event.registeredCount })
                : event.full
                  ? t('seatsFull', { count: event.waitlistCount })
                  : t('seatsLeft', { left, capacity: event.capacity ?? 0 })}
            </Text>
          </div>
          {manager ? (
            <LazyEventManage
              eventId={event.id}
              slug={event.slug}
              status={event.status}
              title={event.title}
            />
          ) : null}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section className="grid content-start gap-6">
          <section aria-labelledby="event-about" className="grid gap-3">
            <Heading level={2} size="section" id="event-about">
              {t('about')}
            </Heading>
            {event.description ? (
              <MarkdownContent source={event.description} />
            ) : (
              <Text tone="muted">{t('noDescription')}</Text>
            )}
          </section>
          {event.project ? (
            <Text size="sm">
              {t('project')}{' '}
              <Link href={routes.project(event.project.slug)} className="link-underline-hover">
                {event.project.title}
              </Link>
            </Text>
          ) : null}
          {view === 'member' ? (
            <section aria-labelledby="event-attendees" className="grid gap-3">
              <Heading level={2} size="section" id="event-attendees">
                {t('attendees')}
              </Heading>
              <LazyAttendees
                eventId={event.id}
                canRead={manager || event.viewer?.registration === 'registered'}
                manager={manager}
              />
            </section>
          ) : null}
        </Section>

        <Section className="grid content-start gap-4">
          <Card className="grid gap-4" aria-labelledby="event-practical">
            <Heading level={2} size="card" id="event-practical">
              {t('practical')}
            </Heading>
            <dl className="grid gap-3 text-sm">
              {event.location ? (
                <div className="grid grid-cols-[auto_1fr] gap-x-2">
                  <dt className="sr-only">{t('place')}</dt>
                  <MapPin aria-hidden className="mt-0.5 size-4 text-muted" />
                  <dd className="grid gap-1">
                    <span>
                      {placeText(event.location)}, {countryName(event.location.countryCode, locale)}
                    </span>
                    <a
                      href={mapUrl(event.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1 link-underline-hover text-accent"
                    >
                      {t('map')}
                      <ExternalLink aria-hidden className="size-4" />
                      <span className="sr-only">{t('newTab')}</span>
                    </a>
                  </dd>
                </div>
              ) : null}
              {event.format !== 'in_person' ? (
                <div className="grid grid-cols-[auto_1fr] gap-x-2" data-online-link="">
                  <dt className="sr-only">{t('onlineLink')}</dt>
                  <Video aria-hidden className="mt-0.5 size-4 text-muted" />
                  <dd>
                    {event.onlineUrl ? (
                      <a
                        href={event.onlineUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 link-underline-hover break-all text-accent"
                      >
                        {t('join')}
                        <ExternalLink aria-hidden className="size-4" />
                        <span className="sr-only">{t('newTab')}</span>
                      </a>
                    ) : (
                      <span className="text-muted">{t('linkHidden')}</span>
                    )}
                  </dd>
                </div>
              ) : null}
              <div className="grid grid-cols-[auto_1fr] gap-x-2">
                <dt className="sr-only">{t('language')}</dt>
                <Languages aria-hidden className="mt-0.5 size-4 text-muted" />
                <dd>
                  {new Intl.DisplayNames([locale], { type: 'language' }).of(event.language) ??
                    event.language}
                </dd>
              </div>
              {sectors.length > 0 ? (
                <div className="grid grid-cols-[auto_1fr] gap-x-2">
                  <dt className="sr-only">{t('sectors')}</dt>
                  <Globe aria-hidden className="mt-0.5 size-4 text-muted" />
                  <dd>{format.list(sectors, { type: 'conjunction' })}</dd>
                </div>
              ) : null}
              <div className="grid grid-cols-[auto_1fr] gap-x-2">
                <dt className="sr-only">{t('capacity')}</dt>
                <Users aria-hidden className="mt-0.5 size-4 text-muted" />
                <dd className="tabular-nums">
                  {event.capacity === null
                    ? t('capacityUnlimited')
                    : t('capacityOf', { capacity: event.capacity })}
                </dd>
              </div>
            </dl>
          </Card>
          {event.status === 'published' ? (
            <Card className="grid gap-3" aria-labelledby="event-calendar">
              <Heading level={2} size="card" id="event-calendar">
                {t('calendar')}
              </Heading>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={icsUrl} download>
                    <Download aria-hidden />
                    {t('ics')}
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={googleCalendarUrl({
                      title: event.title,
                      startsAt: event.startsAt,
                      endsAt: event.endsAt,
                      timeZone: event.timeZone,
                      location: event.location,
                      pageUrl,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <CalendarPlus aria-hidden />
                    {t('google')}
                    <span className="sr-only">{t('newTab')}</span>
                  </a>
                </Button>
              </div>
            </Card>
          ) : null}
        </Section>
      </div>
    </article>
  );
}
