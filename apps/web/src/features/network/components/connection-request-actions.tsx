'use client';

import {
  connectionsControllerAccept,
  connectionsControllerDecline,
  getNotificationsControllerCountersQueryKey,
} from '@pitchorium/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, useAnnounce } from '@/components/ui';
import { useIdempotentMutation } from '@/lib/query/offline';

type Answer = 'accept' | 'decline';

/**
 * « Accepter » and « Ignorer » a connection request where it shows (a notification, the list of
 * requests): the answer replaces the buttons and is said; ignoring does not tell the requester.
 */
export function ConnectionRequestActions({
  requestId,
  name,
}: {
  requestId: string;
  /** The member who asked, for the accessible names of the buttons. */
  name: string;
}) {
  const t = useTranslations('web.network.request');
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const [answered, setAnswered] = useState<Answer | null>(null);
  const answer = useIdempotentMutation({
    mutationKey: ['network', 'connection-request'],
    mutationFn: (choice: Answer, request) =>
      choice === 'accept'
        ? connectionsControllerAccept(requestId, request).then(() => choice)
        : connectionsControllerDecline(requestId, request).then(() => choice),
    onSuccess: (choice) => {
      setAnswered(choice);
      announce(choice === 'accept' ? t('accepted', { name }) : t('declined'));
      void queryClient.invalidateQueries({
        queryKey: getNotificationsControllerCountersQueryKey(),
      });
    },
  });

  if (answered) {
    return (
      <p className="text-sm text-muted">
        {answered === 'accept' ? t('accepted', { name }) : t('declined')}
      </p>
    );
  }
  const pending = answer.isPending ? answer.variables?.input : undefined;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        loading={pending === 'accept'}
        loadingLabel={t('accepting')}
        aria-label={t('acceptName', { name })}
        onClick={() => answer.mutate('accept')}
      >
        {t('accept')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        loading={pending === 'decline'}
        loadingLabel={t('declining')}
        aria-label={t('declineName', { name })}
        onClick={() => answer.mutate('decline')}
      >
        {t('decline')}
      </Button>
    </div>
  );
}
