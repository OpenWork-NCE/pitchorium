'use client';

import { missionsControllerClose, useMissionsControllerEngagements } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AlertDialog, Button, Loading, Skeleton, Text, useAnnounce } from '@/components/ui';
import { useCurrentMember } from '@/features/identity';
import { useRouter } from '@/i18n/navigation';
import { EngagementRow } from './engagement-row';
import { useMissionProblem } from './use-mission-problem';

/**
 * The author's view of their mission: the engagements received (each answered on its page), and
 * the closing of the mission (no new engagement; those in progress continue).
 */
export function AuthorPanel({ missionId, open }: { missionId: string; open: boolean }) {
  const t = useTranslations('web.missions.author');
  const member = useCurrentMember();
  const router = useRouter();
  const announce = useAnnounce();
  const problem = useMissionProblem();
  const [error, setError] = useState<string | null>(null);
  const engagements = useMissionsControllerEngagements(missionId, { limit: 50 });
  return (
    <div className="grid gap-4">
      {engagements.isPending ? (
        <Loading>
          <Skeleton className="h-16 w-full rounded-xl" />
        </Loading>
      ) : (engagements.data?.items.length ?? 0) === 0 ? (
        <Text size="sm" tone="muted">
          {t('none')}
        </Text>
      ) : (
        <ul className="grid gap-2" aria-label={t('engagements')}>
          {engagements.data?.items.map((engagement) => (
            <li key={engagement.id}>
              <EngagementRow engagement={engagement} viewerHandle={member.profile.handle} />
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {open ? (
        <AlertDialog
          trigger={
            <Button variant="outline" className="w-full sm:w-fit">
              {t('close')}
            </Button>
          }
          title={t('closeTitle')}
          description={t('closeBody')}
          confirmLabel={t('close')}
          tone="primary"
          onConfirm={async () => {
            try {
              await missionsControllerClose(missionId);
              announce(t('closed'));
              router.refresh();
            } catch (failure) {
              setError(problem(failure));
            }
          }}
        />
      ) : null}
    </div>
  );
}
