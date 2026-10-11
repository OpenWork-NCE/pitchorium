'use client';

import {
  getInvitationsControllerReceivedQueryKey,
  invitationsControllerAcceptReceived,
  invitationsControllerDeclineReceived,
  useInvitationsControllerReceived,
} from '@pitchorium/api-client';
import type { ReceivedInvitation } from '@pitchorium/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Skeleton,
  Text,
  useAnnounce,
  VerifiedBadge,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { useWithPrerequisites } from '@/features/access';
import { Link, useRouter } from '@/i18n/navigation';
import { useOrganizationProblem } from './manage/use-organization-problem';
import { COUNTERS_QUERY_KEY } from '@/lib/query/keys';

/**
 * The open invitations to an organisation sent to the verified email of the member (ADR 0149):
 * answered here, without the link of the email. Accepted, the member lands on the page of the
 * organisation; declined, the line says so and leaves at the next reading.
 */
export function OrganizationInvitations() {
  const t = useTranslations('web.organizations.received');
  const invitations = useInvitationsControllerReceived({ query: { staleTime: 30_000 } });
  return (
    <section aria-labelledby="organization-invitations-title" className="grid gap-4">
      <Heading level={2} size="section" id="organization-invitations-title">
        {t('title')}
      </Heading>
      {invitations.isPending ? (
        <Loading>
          <Skeleton className="h-28 w-full rounded-xl" />
        </Loading>
      ) : invitations.isError ? (
        <ErrorState
          title={t('error')}
          headingLevel={3}
          retrying={invitations.isRefetching}
          onRetry={() => void invitations.refetch()}
        />
      ) : invitations.data.items.length === 0 ? (
        <EmptyState size="inline" headingLevel={3} title={t('none')} description={t('noneHint')} />
      ) : (
        <ul className="grid gap-4">
          {invitations.data.items.map((invitation) => (
            <li key={invitation.id}>
              <InvitationCard invitation={invitation} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InvitationCard({ invitation }: { invitation: ReceivedInvitation }) {
  const t = useTranslations('web.organizations.received');
  const roles = useTranslations('reference.organizationRoles');
  const format = useFormatter();
  const router = useRouter();
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const problem = useOrganizationProblem();
  const withPrerequisites = useWithPrerequisites();
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { organization } = invitation;

  async function answer(choice: 'accept' | 'decline') {
    setPending(choice);
    setError(null);
    try {
      if (choice === 'accept') {
        await withPrerequisites(() => invitationsControllerAcceptReceived(invitation.id));
        announce(t('accepted', { name: organization.name }));
        router.push(routes.organization(organization.slug));
      } else {
        await withPrerequisites(() => invitationsControllerDeclineReceived(invitation.id));
        setDeclined(true);
        announce(t('declined', { name: organization.name }));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getInvitationsControllerReceivedQueryKey() }),
        queryClient.invalidateQueries({ queryKey: COUNTERS_QUERY_KEY }),
      ]);
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="grid gap-3" data-invitation={invitation.id}>
      <div className="flex items-center gap-3">
        <Avatar
          name={organization.name}
          src={organization.logoUrl}
          size="md"
          shape="square"
          decorative
        />
        <div className="grid min-w-0 gap-0.5">
          <span className="inline-flex items-center gap-1.5">
            <Heading level={3} size="card" className="truncate">
              <Link href={routes.organization(organization.slug)} className="link-underline-hover">
                {organization.name}
              </Link>
            </Heading>
            {organization.verified ? <VerifiedBadge /> : null}
          </span>
          <Text size="sm" tone="muted">
            {t('role', {
              role: roles(invitation.role),
              date: format.dateTime(new Date(invitation.expiresAt), { dateStyle: 'long' }),
            })}
          </Text>
        </div>
      </div>
      {error ? (
        <Alert tone="danger" live="alert">
          {error}
        </Alert>
      ) : null}
      {declined ? (
        <Text size="sm" tone="muted" role="status">
          {t('declined', { name: organization.name })}
        </Text>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            loading={pending === 'accept'}
            loadingLabel={t('accepting')}
            onClick={() => void answer('accept')}
          >
            {t('accept')}
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={pending === 'decline'}
            loadingLabel={t('declining')}
            onClick={() => void answer('decline')}
          >
            {t('decline')}
          </Button>
        </div>
      )}
    </Card>
  );
}
