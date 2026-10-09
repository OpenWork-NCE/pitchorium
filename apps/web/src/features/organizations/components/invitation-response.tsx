'use client';

import { invitationsControllerAccept, invitationsControllerDecline } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert, Button, FormActions, useAnnounce } from '@/components/ui';
import { routes } from '@/config/routes';
import { useWithPrerequisites } from '@/features/access';
import { useRouter } from '@/i18n/navigation';
import { useOrganizationProblem } from './manage/use-organization-problem';

/**
 * The answer of a member to an invitation received by email: accepted, they land on the page of
 * the organisation; declined, it is said here. The api checks that their verified email is the
 * invited address (a missing verification opens its form, then the answer runs again).
 */
export function InvitationResponse({
  token,
  slug,
  name,
}: {
  token: string;
  slug: string;
  name: string;
}) {
  const t = useTranslations('web.organizations.invitation');
  const router = useRouter();
  const announce = useAnnounce();
  const problem = useOrganizationProblem();
  const withPrerequisites = useWithPrerequisites();
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(choice: 'accept' | 'decline') {
    setPending(choice);
    setError(null);
    try {
      if (choice === 'accept') {
        await withPrerequisites(() => invitationsControllerAccept({ token }));
        announce(t('accepted', { name }));
        router.push(routes.organization(slug));
        return;
      }
      await withPrerequisites(() => invitationsControllerDecline({ token }));
      setDeclined(true);
      announce(t('declined'));
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setPending(null);
    }
  }

  if (declined) return <Alert tone="info">{t('declined')}</Alert>;
  return (
    <div className="grid gap-4">
      {error ? (
        <Alert tone="danger" live="alert">
          {error}
        </Alert>
      ) : null}
      <FormActions>
        <Button
          loading={pending === 'accept'}
          loadingLabel={t('accepting')}
          disabled={pending !== null}
          onClick={() => void answer('accept')}
        >
          {t('accept')}
        </Button>
        <Button
          variant="outline"
          loading={pending === 'decline'}
          loadingLabel={t('declining')}
          disabled={pending !== null}
          onClick={() => void answer('decline')}
        >
          {t('decline')}
        </Button>
      </FormActions>
    </div>
  );
}
