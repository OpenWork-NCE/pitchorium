'use client';

import {
  getTeamControllerInvitationsQueryKey,
  teamControllerAccept,
  teamControllerDecline,
  useTeamControllerInvitations,
} from '@pitchorium/api-client';
import type { ProjectInvitation } from '@pitchorium/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Card, Checkbox, Heading, Text, useAnnounce } from '@/components/ui';
import { routes } from '@/config/routes';
import { useRouter } from '@/i18n/navigation';
import { useProblemText } from './shared/use-problem-text';

/**
 * The invitations of the member to join the team of a project (§11.2, ADR 0040): accepting asks
 * for the consent to the public display of their name, photo and title on its page, even when
 * their own profile stays private; declining tells the team.
 */
export function ProjectInvitations() {
  const t = useTranslations('web.projects.invitations');
  const invitations = useTeamControllerInvitations({ query: { staleTime: 30_000 } });
  const items = invitations.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="project-invitations-title" className="grid gap-4">
      <Heading level={2} size="section" id="project-invitations-title">
        {t('title')}
      </Heading>
      <ul className="grid gap-4">
        {items.map((invitation) => (
          <InvitationItem key={invitation.project.id} invitation={invitation} />
        ))}
      </ul>
    </section>
  );
}

function InvitationItem({ invitation }: { invitation: ProjectInvitation }) {
  const t = useTranslations('web.projects.invitations');
  const roles = useTranslations('reference.projectTeamRoles');
  const queryClient = useQueryClient();
  const problemText = useProblemText();
  const announce = useAnnounce();
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const { project } = invitation;
  async function answer(accept: boolean) {
    if (accept && !consent) {
      setConsentError(true);
      return;
    }
    setBusy(accept ? 'accept' : 'decline');
    setProblem(null);
    try {
      if (accept) await teamControllerAccept(project.id, { publicDisplayConsent: true });
      else await teamControllerDecline(project.id);
      announce(
        accept ? t('accepted', { title: project.title }) : t('declined', { title: project.title }),
      );
      await queryClient.invalidateQueries({ queryKey: getTeamControllerInvitationsQueryKey() });
      if (accept) router.push(routes.project(project.slug));
    } catch (error) {
      setProblem(problemText(error));
    } finally {
      setBusy(null);
    }
  }
  return (
    <li>
      <Card className="grid gap-3">
        <Heading level={3} size="card">
          {project.title}
        </Heading>
        <Text size="sm" tone="muted">
          {t('invited', {
            name: invitation.invitedBy?.displayName ?? t('someone'),
            role: roles(invitation.role),
          })}
        </Text>
        <Checkbox
          label={t('consent')}
          description={t('consentHint')}
          checked={consent}
          aria-invalid={consentError && !consent}
          onCheckedChange={(checked) => {
            setConsent(checked === true);
            setConsentError(false);
          }}
        />
        {consentError && !consent ? (
          <p role="alert" className="text-sm text-danger">
            {t('consentRequired')}
          </p>
        ) : null}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            loading={busy === 'accept'}
            loadingLabel={t('accepting')}
            onClick={() => void answer(true)}
          >
            {t('accept')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            loading={busy === 'decline'}
            loadingLabel={t('declining')}
            onClick={() => void answer(false)}
          >
            {t('decline')}
          </Button>
        </div>
      </Card>
    </li>
  );
}
