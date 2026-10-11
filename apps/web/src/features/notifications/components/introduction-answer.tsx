'use client';

import {
  getNotificationsControllerCountersQueryKey,
  messagingControllerAcceptIntroduction,
  messagingControllerDeclineIntroduction,
} from '@pitchorium/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, useAnnounce } from '@/components/ui';

/**
 * « Accepter » and « Décliner » an introduction from its notification (§10.4, §10.5): the answer
 * replaces the buttons and is said; a decline is never told to the introducer by name.
 */
export function IntroductionAnswer({
  introductionId,
  name,
}: {
  introductionId: string;
  /** The introducer, for the accessible names of the buttons. */
  name: string;
}) {
  const t = useTranslations('web.notifications.introduction');
  const errors = useTranslations('errors');
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [answered, setAnswered] = useState<'accept' | 'decline' | null>(null);
  const [failed, setFailed] = useState(false);

  async function answer(choice: 'accept' | 'decline') {
    setBusy(choice);
    setFailed(false);
    try {
      await (choice === 'accept'
        ? messagingControllerAcceptIntroduction(introductionId)
        : messagingControllerDeclineIntroduction(introductionId));
      setAnswered(choice);
      announce(choice === 'accept' ? t('accepted') : t('declined'));
      void queryClient.invalidateQueries({
        queryKey: getNotificationsControllerCountersQueryKey(),
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  if (answered) {
    return (
      <p className="text-sm text-muted">{answered === 'accept' ? t('accepted') : t('declined')}</p>
    );
  }
  return (
    <div className="grid gap-2">
      <div className="grid max-w-xs grid-cols-2 gap-2 *:px-3 sm:flex sm:max-w-none sm:*:px-4">
        <Button
          size="sm"
          loading={busy === 'accept'}
          loadingLabel={t('accepting')}
          aria-label={t('acceptName', { name })}
          onClick={() => void answer('accept')}
        >
          {t('accept')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={busy === 'decline'}
          loadingLabel={t('declining')}
          aria-label={t('declineName', { name })}
          onClick={() => void answer('decline')}
        >
          {t('decline')}
        </Button>
      </div>
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {errors('INTERNAL_ERROR')}
        </p>
      ) : null}
    </div>
  );
}
