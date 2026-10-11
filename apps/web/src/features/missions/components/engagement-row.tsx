import type { MissionEngagement } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { Avatar, Badge, Card, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';

const TONES = {
  requested: 'info',
  accepted: 'accent',
  declined: 'neutral',
  completed: 'success',
  canceled: 'neutral',
} as const;

/** An engagement of the member: the mission, the other party, its state; it opens its page. */
export function EngagementRow({
  engagement,
  viewerHandle,
}: {
  engagement: MissionEngagement;
  viewerHandle: string | null;
}) {
  const t = useTranslations('web.missions.engagement');
  const statuses = useTranslations('reference.missionEngagementStatuses');
  const other =
    engagement.expert.handle === viewerHandle ? engagement.beneficiary : engagement.expert;
  return (
    <Card className="relative flex items-center gap-3" data-engagement={engagement.id}>
      <Avatar name={other.displayName} src={other.avatarUrl} size="md" decorative />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <Link
          href={routes.missionEngagement(engagement.id)}
          className="truncate link-underline-hover font-semibold outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-focus"
        >
          {engagement.mission.title}
        </Link>
        <Text size="sm" tone="muted" className="truncate">
          {engagement.expert.handle === viewerHandle
            ? t('withBeneficiary', { name: other.displayName })
            : t('withExpert', { name: other.displayName })}
        </Text>
      </div>
      <Badge tone={TONES[engagement.status]}>{statuses(engagement.status)}</Badge>
    </Card>
  );
}
