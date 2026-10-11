import type { DiscoveryCard } from '@pitchorium/contracts';
import { Briefcase, CalendarDays } from 'lucide-react';
import { getImageProps } from 'next/image';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Avatar, Badge, Card, Text, VerifiedBadge } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { countryName } from '@/lib/format/countries';
import { resultHref } from '../lib/hrefs';

interface ResultCardProps {
  card: DiscoveryCard;
  /** The reason of a suggested profile (§11.4), under its title. */
  reason?: string | null;
  /** An action of the card (« Se connecter » of a suggested profile). */
  action?: ReactNode;
  headingLevel?: 2 | 3;
}

/**
 * A result of the search or a card of « Découvrir » (§10.6), by kind: a person or an organisation
 * by their picture and title, a project or an event by its image, a mission by its sense. The
 * title is the link (one link per card); rendered by the server as by the browser.
 */
export function ResultCard({ card, reason, action, headingLevel = 3 }: ResultCardProps) {
  const t = useTranslations('web.discovery.cards');
  const reference = useTranslations('reference');
  const format = useFormatter();
  const locale = useLocale();
  const href = resultHref(card.kind, card.key);
  const sector = card.sectorCodes[0];
  const meta: string[] = [];
  if (sector) {
    meta.push(
      reference.has(`sectorsShort.${sector}` as never)
        ? reference(`sectorsShort.${sector}` as never)
        : reference(`sectors.${sector}` as never),
    );
  }
  const country = card.countryCodes[0];
  if (country) meta.push(countryName(country, locale));
  const visual =
    card.kind === 'person' || card.kind === 'organization' ? (
      <Avatar
        name={card.title}
        src={card.imageUrl}
        size="lg"
        shape={card.kind === 'organization' ? 'square' : 'circle'}
        decorative
      />
    ) : card.kind === 'mission' ? (
      <span
        aria-hidden
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-on-accent-subtle"
      >
        <Briefcase className="size-6" />
      </span>
    ) : null;
  const image =
    (card.kind === 'project' || card.kind === 'event') && card.imageUrl ? (
      // The props of next/image without its client component (ADR 0094); `alt` is in them.
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      <img
        {...getImageProps({
          src: card.imageUrl,
          alt: '',
          fill: true,
          sizes: '(min-width: 1024px) 400px, 100vw',
          className: 'object-cover',
        }).props}
      />
    ) : null;
  const Title = `h${headingLevel}` as const;
  return (
    <Card
      padding="none"
      className="relative grid h-full min-w-0 content-start gap-3 overflow-hidden"
      data-result-kind={card.kind}
    >
      {card.kind === 'project' || card.kind === 'event' ? (
        <div
          className={cn(
            'relative w-full overflow-hidden bg-cover-placeholder',
            card.kind === 'event' ? 'aspect-video' : 'aspect-[4/3]',
          )}
        >
          {/* The elevation pattern, brightened on the deep violet of the dark theme. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-[url(/brand/overlay-desktop.svg)] bg-cover bg-center dark:brightness-[2.6]"
          />
          {image}
          {card.kind === 'event' ? (
            <CalendarDays
              aria-hidden
              className="absolute top-3 left-3 size-5 rounded-md bg-surface p-0.5 text-muted"
            />
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          'grid min-w-0 gap-2 px-5 pb-5',
          card.kind === 'project' || card.kind === 'event' ? '' : 'pt-5',
        )}
      >
        <div className="flex items-start gap-3">
          {visual}
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{t(`kinds.${card.kind}`)}</Badge>
              {card.kind === 'mission' ? (
                <Badge tone="accent">{reference(`missionDirections.${card.direction}`)}</Badge>
              ) : null}
              {card.kind === 'event' ? (
                <Badge>{reference(`eventFormats.${card.format}`)}</Badge>
              ) : null}
              {card.kind === 'project' ? (
                <Badge>{reference(`projectStatuses.${card.status}`)}</Badge>
              ) : null}
            </div>
            <Title className="font-sans text-lg leading-snug font-semibold text-pretty break-words">
              <Link
                href={href}
                className="link-underline-hover outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-focus"
              >
                {card.title}
              </Link>
              {card.kind === 'organization' && card.verified ? (
                <VerifiedBadge className="ml-1.5 align-middle" />
              ) : null}
            </Title>
            {card.subtitle ? (
              <Text size="sm" tone="muted" className="line-clamp-2">
                {card.subtitle}
              </Text>
            ) : null}
          </div>
        </div>
        {card.kind === 'event' ? (
          <Text size="sm">
            {format.dateTime(new Date(card.startsAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: card.timeZone,
            })}
          </Text>
        ) : null}
        {card.kind === 'mission' ? (
          <Text size="sm" tone="muted">
            {t('mission', {
              kind: reference(`timeEntryKinds.${card.missionKind}`),
              mode: reference(`missionModes.${card.mode}`),
            })}
          </Text>
        ) : null}
        {meta.length > 0 ? (
          <Text size="sm" tone="muted">
            {meta.join(' · ')}
          </Text>
        ) : null}
        {reason ? <Text size="sm">{reason}</Text> : null}
        {action ? <div className="relative z-[1] pt-1">{action}</div> : null}
      </div>
    </Card>
  );
}

/** A grid of cards, wide (§10.6): three across on a computer, two on a tablet, one on a phone. */
export function ResultGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}
