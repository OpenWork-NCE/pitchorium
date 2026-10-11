import type { MissionView } from '@pitchorium/contracts';
import { HandHeart } from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  DescriptionList,
  Heading,
  Text,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { MemberHoverCard } from '@/features/profiles';
import { Link } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { countryName } from '@/lib/format/countries';
import { LazyAuthorPanel, LazyEngage } from './lazy-islands';

/**
 * The page of a mission (§6.3, ADR 0071): its content, its author with the preview of their
 * profile, the visible mention of volunteer skills sponsorship, then what the reader can do: apply
 * to a request or solicit an offer with a message, follow their own engagement, or, for the
 * author, answer the engagements and close the mission. Never a salary, a contract nor a
 * structured job offer.
 */
export async function MissionPage({
  mission,
  view,
}: {
  mission: MissionView;
  view: 'visitor' | 'member';
}) {
  const t = await getTranslations('web.missions.page');
  const reference = await getTranslations('reference');
  const locale = await getLocale();
  const format = await getFormatter();
  const signedIn = view === 'member';
  const list = (items: string[]) => format.list(items, { type: 'conjunction' });
  const languageNames = new Intl.DisplayNames([locale], { type: 'language' });
  const details = [
    {
      term: t('format'),
      description: t('hours', {
        format: reference(`missionFormats.${mission.format}`),
        hours: mission.estimatedHours,
      }),
    },
    { term: t('mode'), description: reference(`missionModes.${mission.mode}`) },
    ...(mission.countryCodes.length > 0
      ? [
          {
            term: t('countries'),
            description: list(mission.countryCodes.map((code) => countryName(code, locale))),
          },
        ]
      : []),
    {
      term: t('languages'),
      description: list(mission.languages.map((code) => languageNames.of(code) ?? code)),
    },
    ...(mission.sectorCodes.length > 0
      ? [
          {
            term: t('sectors'),
            description: list(
              mission.sectorCodes.map((code) => reference(`sectors.${code}` as never)),
            ),
          },
        ]
      : []),
    ...(mission.direction === 'request' && mission.skills.length > 0
      ? [{ term: t('skills'), description: list(mission.skills) }]
      : []),
    ...(mission.desiredBy
      ? [
          {
            term: t('desiredBy'),
            description: format.dateTime(new Date(`${mission.desiredBy}T12:00:00Z`), {
              dateStyle: 'long',
              timeZone: 'UTC',
            }),
          },
        ]
      : []),
    ...(mission.direction === 'offer'
      ? [
          {
            term: t('capacity'),
            description: t('capacityOf', {
              active: mission.activeEngagements,
              capacity: mission.capacity,
            }),
          },
        ]
      : []),
  ];
  return (
    <article className="grid gap-8" data-mission={mission.id}>
      <header className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">{reference(`missionDirections.${mission.direction}`)}</Badge>
          <Badge>{reference(`timeEntryKinds.${mission.kind}`)}</Badge>
          {mission.status === 'closed' ? (
            <Badge>{reference('missionStatuses.closed')}</Badge>
          ) : null}
        </div>
        <Heading level={1} size="page" className="text-balance">
          {mission.title}
        </Heading>
        <Text tone="muted">{mission.domain}</Text>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Avatar
            name={mission.author.member.displayName}
            src={mission.author.member.avatarUrl}
            size="sm"
            decorative
          />
          <span className="text-muted">
            {mission.direction === 'offer' ? t('offeredBy') : t('requestedBy')}
          </span>
          <MemberHoverCard
            member={mission.author.member}
            signedIn={signedIn}
            className="font-medium hover:underline"
          />
          {mission.author.project ? (
            <>
              <span className="text-muted">{t('forProject')}</span>
              <Link
                href={routes.project(mission.author.project.slug)}
                className="link-underline-hover font-medium"
              >
                {mission.author.project.title}
              </Link>
            </>
          ) : null}
        </div>
      </header>
      <Callout icon={<HandHeart />} title={t('volunteerTitle')}>
        {t('volunteer')}
      </Callout>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="mission-description" className="grid content-start gap-3">
          <Heading level={2} size="section" id="mission-description">
            {t('description')}
          </Heading>
          <Text className="whitespace-pre-line">{mission.description}</Text>
        </section>
        <div className="grid content-start gap-4">
          <Card className="grid gap-4" aria-labelledby="mission-details">
            <Heading level={2} size="card" id="mission-details">
              {t('details')}
            </Heading>
            <DescriptionList items={details} />
          </Card>
          <Card className="grid gap-3" aria-labelledby="mission-take-part">
            <Heading level={2} size="card" id="mission-take-part">
              {mission.viewer?.isAuthor ? t('yourMission') : t('takePart')}
            </Heading>
            {!signedIn ? (
              mission.status === 'open' ? (
                <Button asChild>
                  <Link href={withRedirect(routes.signIn, routes.mission(mission.id))}>
                    {t('signIn')}
                  </Link>
                </Button>
              ) : (
                <Text size="sm" tone="muted">
                  {t('closed')}
                </Text>
              )
            ) : mission.viewer?.isAuthor ? (
              <LazyAuthorPanel missionId={mission.id} open={mission.status === 'open'} />
            ) : mission.viewer?.engagementId ? (
              <Button asChild variant="outline">
                <Link href={routes.missionEngagement(mission.viewer.engagementId)}>
                  {t('yourEngagement')}
                </Link>
              </Button>
            ) : mission.status === 'closed' ? (
              <Text size="sm" tone="muted">
                {t('closed')}
              </Text>
            ) : (
              <LazyEngage
                missionId={mission.id}
                direction={mission.direction}
                canEngage={mission.viewer?.canEngage === true}
              />
            )}
          </Card>
        </div>
      </div>
    </article>
  );
}
