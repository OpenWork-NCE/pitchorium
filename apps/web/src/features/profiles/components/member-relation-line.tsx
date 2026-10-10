'use client';

import { useMemberNetworkControllerRelationship } from '@pitchorium/api-client';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge, Skeleton } from '@/components/ui';
import { usePlural } from '@/lib/i18n/plural';

/**
 * The degree of relation and the connections in common with a member, in their preview
 * (MemberHoverCard), read when it first opens.
 */
export default function RelationLine({ handle }: { handle: string }) {
  const t = useTranslations('web.profile.hover');
  const reference = useTranslations('reference.relationDegrees');
  const format = useFormatter();
  const plural = usePlural();
  const relationship = useMemberNetworkControllerRelationship(handle, {
    query: { staleTime: 60_000, retry: false },
  });
  if (relationship.isPending) return <Skeleton className="h-5 w-40" />;
  if (!relationship.data || relationship.data.degree === 'self') return null;
  const { degree, mutualConnections } = relationship.data;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge tone="accent">{reference(degree)}</Badge>
      {mutualConnections.count > 0 ? (
        <span className="text-muted">
          {t(`mutual.${plural(mutualConnections.count)}`, {
            count: `${format.number(mutualConnections.count)}${mutualConnections.capped ? '+' : ''}`,
          })}
        </span>
      ) : null}
    </div>
  );
}
