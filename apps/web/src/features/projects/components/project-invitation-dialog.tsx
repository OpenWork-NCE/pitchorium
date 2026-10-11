'use client';

import { useTeamControllerInvitations } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { DialogContent, Loading, Skeleton, Text } from '@/components/ui';
import { ProjectInvitationAnswer } from './project-invitations';

/**
 * The answer to an invitation to the team of a project, opened from its notification (FRONT 7,
 * A1): the same consent to the public display as in the list, without leaving the page. An
 * invitation already answered or withdrawn says so.
 */
export function ProjectInvitationDialogContent({
  slug,
  title,
  onClose,
}: {
  slug: string;
  title: string;
  onClose: () => void;
}) {
  const t = useTranslations('web.projects.invitations');
  const invitations = useTeamControllerInvitations({ query: { staleTime: 30_000 } });
  const invitation = invitations.data?.items.find((item) => item.project.slug === slug);
  return (
    <DialogContent title={t('dialogTitle', { title })} size="md">
      {invitations.isPending ? (
        <Loading>
          <Skeleton className="h-40 w-full" />
        </Loading>
      ) : invitation ? (
        <ProjectInvitationAnswer invitation={invitation} onAnswered={onClose} />
      ) : (
        <Text size="sm" tone="muted">
          {t('closed')}
        </Text>
      )}
    </DialogContent>
  );
}
