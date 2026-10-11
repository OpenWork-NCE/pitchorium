import type { MissionCard as MissionCardData } from '@pitchorium/contracts';
import { Clock, HandHeart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, Badge, Card, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';

/**
 * A mission in a list (§6.3, ADR 0071): its sense (offer of an expert or a mentor, request of a
 * project), its field, its format and its hours, its author; never a salary, a contract nor any
 * sign of a job offer. The title is the one link of the card.
 */
export function MissionCard({
  mission,
  headingLevel = 2,
}: {
  mission: MissionCardData;
  headingLevel?: 2 | 3;
}) {
  const t = useTranslations('web.missions.card');
  const reference = useTranslations('reference');
  const Title = `h${headingLevel}` as const;
  return (
    <Card
      className="relative grid h-full min-w-0 content-start gap-3"
      data-mission-card={mission.id}
    >
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="accent">{reference(`missionDirections.${mission.direction}`)}</Badge>
        <Badge>{reference(`timeEntryKinds.${mission.kind}`)}</Badge>
        {mission.status === 'closed' ? <Badge>{reference('missionStatuses.closed')}</Badge> : null}
      </div>
      <Title className="font-sans text-lg leading-snug font-semibold text-pretty break-words">
        <Link
          href={routes.mission(mission.id)}
          className="link-underline-hover outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-focus"
        >
          {mission.title}
        </Link>
      </Title>
      <Text size="sm" tone="muted">
        {mission.domain}
      </Text>
      <Text size="sm" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden className="size-4 text-muted" />
          {t('hours', {
            format: reference(`missionFormats.${mission.format}`),
            hours: mission.estimatedHours,
          })}
        </span>
        <span>{reference(`missionModes.${mission.mode}`)}</span>
      </Text>
      <div className="flex min-w-0 items-center gap-2 pt-1">
        <Avatar
          name={mission.author.member.displayName}
          src={mission.author.member.avatarUrl}
          size="xs"
          decorative
        />
        <Text size="sm" tone="muted" className="min-w-0 truncate">
          {mission.author.project
            ? t('byForProject', {
                name: mission.author.member.displayName,
                project: mission.author.project.title,
              })
            : t('by', { name: mission.author.member.displayName })}
        </Text>
      </div>
      <Text size="xs" tone="muted" className="flex items-center gap-1.5">
        <HandHeart aria-hidden className="size-4" />
        {t('volunteer')}
      </Text>
    </Card>
  );
}
