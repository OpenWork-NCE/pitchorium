'use client';

import {
  notificationsControllerResubscribe,
  notificationsControllerUnsubscribe,
} from '@pitchorium/api-client';
import type { UnsubscribeResult } from '@pitchorium/contracts';
import { BellOff, BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button, EmptyState, Heading, Spinner, Text } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import * as routes from '@/config/paths';
import { configureBrowserApi } from '@/lib/api/browser';
import { withRedirect } from '@/lib/auth/redirect';

configureBrowserApi();

type State =
  | { step: 'working' }
  | { step: 'off'; result: UnsubscribeResult }
  | { step: 'back'; result: UnsubscribeResult }
  | { step: 'invalid' }
  | { step: 'failed' };

/**
 * The page of the link of an email (§10.5, ADR 0062), without a session: the signed token turns
 * the email of its type off (or the digest), done in the browser so that a link checker of a
 * mailbox never does it; it says what was turned off, offers to undo it, and leads to the
 * preferences once signed in.
 */
export function Unsubscribe({ token, signedIn }: { token: string; signedIn: boolean }) {
  const t = useTranslations('web.unsubscribe');
  const types = useTranslations('reference.notificationTypes');
  const [state, setState] = useState<State>({ step: 'working' });
  const [undoing, setUndoing] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    notificationsControllerUnsubscribe({ token }).then(
      (result) => setState({ step: 'off', result: result }),
      (error: unknown) =>
        setState(
          (error as { problem?: { code?: string } }).problem?.code ===
            'NOTIFICATIONS_UNSUBSCRIBE_INVALID' ||
            (error as { problem?: { code?: string } }).problem?.code === 'VALIDATION_FAILED'
            ? { step: 'invalid' }
            : { step: 'failed' },
        ),
    );
  }, [token]);

  async function undo(result: UnsubscribeResult) {
    setUndoing(true);
    try {
      await notificationsControllerResubscribe(
        result.scope === 'digest' && result.previousDigest && result.previousDigest !== 'off'
          ? { emailDigest: result.previousDigest }
          : {},
        { token },
      );
      setState({ step: 'back', result });
    } catch {
      setState({ step: 'failed' });
    } finally {
      setUndoing(false);
    }
  }

  const preferences = signedIn
    ? routes.settingsNotifications
    : withRedirect(routes.signIn, routes.settingsNotifications);

  if (state.step === 'working') {
    return (
      <div className="flex items-center gap-3" aria-busy>
        <Spinner label={t('working')} />
        <Text>{t('working')}</Text>
      </div>
    );
  }
  if (state.step === 'invalid' || state.step === 'failed') {
    return (
      <EmptyState
        icon={<BellOff />}
        size="inline"
        title={state.step === 'invalid' ? t('invalidTitle') : t('failedTitle')}
        description={state.step === 'invalid' ? t('invalidBody') : t('failedBody')}
        action={
          <Button asChild variant="secondary">
            <Link href={preferences}>{t('preferences')}</Link>
          </Button>
        }
      />
    );
  }
  const what =
    state.result.scope === 'digest' ? t('digest') : t('type', { type: types(state.result.scope) });
  const off = state.step === 'off';
  return (
    <div className="grid gap-4">
      <span aria-hidden className="text-accent [&_svg]:size-6">
        {off ? <BellOff /> : <BellRing />}
      </span>
      <Heading level={2} size="card">
        {off ? t('offTitle') : t('backTitle')}
      </Heading>
      <Text role="status">{off ? t('offBody', { what }) : t('backBody', { what })}</Text>
      {off && state.result.scope !== 'digest' ? <Text tone="muted">{t('others')}</Text> : null}
      <div className="flex flex-wrap gap-2">
        {off ? (
          <Button
            variant="secondary"
            loading={undoing}
            loadingLabel={t('undoing')}
            onClick={() => void undo(state.result)}
          >
            {t('undo')}
          </Button>
        ) : null}
        <Button asChild variant="ghost">
          <Link href={preferences}>{t('preferences')}</Link>
        </Button>
      </div>
      {signedIn ? null : (
        <Text size="sm" tone="muted">
          {t('signInFirst')}
        </Text>
      )}
    </div>
  );
}
