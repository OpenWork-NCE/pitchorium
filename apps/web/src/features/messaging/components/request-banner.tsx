'use client';

import { Inbox, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Callout, notify } from '@/components/ui';
import { routes } from '@/config/routes';
import { useRouter } from '@/i18n/navigation';
import { useMessagingProblem } from '../hooks/use-messaging-problem';

/**
 * A conversation that is a request (§10.4): received, accepted to answer or declined silently
 * (the sender is never told, the conversation leaves the list); sent, its wait for the answer.
 */
export default function RequestBanner({
  state,
  names,
  accept,
  decline,
}: {
  state: 'sent' | 'received';
  names: string;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
}) {
  const t = useTranslations('web.messaging');
  const router = useRouter();
  const problem = useMessagingProblem();
  const [answering, setAnswering] = useState<'accept' | 'decline' | null>(null);

  async function answer(accepted: boolean) {
    setAnswering(accepted ? 'accept' : 'decline');
    try {
      if (accepted) {
        await accept();
        notify.success(t('request.accepted'));
      } else {
        await decline();
        router.push(routes.messageRequests);
      }
    } catch (error) {
      notify.error(problem(error));
    } finally {
      setAnswering(null);
    }
  }

  if (state === 'sent') {
    return (
      <Callout className="m-3" icon={<Inbox />} title={t('request.sentTitle')}>
        {t('request.sentBody', { name: names })}
      </Callout>
    );
  }
  return (
    <Callout
      className="m-3"
      icon={<UserPlus />}
      title={t('request.receivedTitle', { name: names })}
    >
      <div className="grid gap-3">
        <p>{t('request.receivedBody')}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={answering === 'accept'}
            loadingLabel={t('request.accepting')}
            onClick={() => void answer(true)}
          >
            {t('request.accept')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={answering === 'decline'}
            loadingLabel={t('request.declining')}
            onClick={() => void answer(false)}
          >
            {t('request.decline')}
          </Button>
        </div>
      </div>
    </Callout>
  );
}
