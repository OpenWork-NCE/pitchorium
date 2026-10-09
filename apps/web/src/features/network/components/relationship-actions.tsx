'use client';

import {
  connectionsControllerAccept,
  connectionsControllerDecline,
  connectionsControllerRemove,
  connectionsControllerWithdraw,
  followsControllerFollow,
  followsControllerUnfollow,
} from '@pitchorium/api-client';
import type { Relationship } from '@pitchorium/contracts';
import { Check, Clock, UserCheck, UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import { IconSwap, LabelSwap } from '@/components/motion';
import { AlertDialog, Button, notify, useAnnounce } from '@/components/ui';
import type { RelationshipAction } from '../lib/relationship';
import { RelationshipMenu } from './relationship-menu';
import { useProblemMessage, useRelationship } from './use-relationship';

/** The dialog of a request with its note loads at its first use (ADR 0094). */
const ConnectDialog = lazy(() =>
  import('./connect-dialog').then((module) => ({ default: module.ConnectDialog })),
);

interface RelationshipActionsProps {
  handle: string;
  /** Name of the member, for the accessible names and the messages. */
  name: string;
  /** The relationship read by the server for the first render. */
  relationship: Relationship;
  /** Absolute address of the profile, to copy or share. */
  url: string;
}

type ConnectionStep = 'connect' | 'pending' | 'connected';

/**
 * Actions of the reader towards a member (§10.2), from their relationship (ADR 0113):
 * « Se connecter » (a dialog with an optional note), which becomes « En attente » (withdraw the
 * request), then « En relation » (remove the connection); « Accepter » and « Ignorer » a
 * request received; « Suivre » and « Ne plus suivre »; a menu (copy the link, share, block).
 * Each change shows at once and comes back if the api refuses it (ADR 0112); a button swaps
 * its icon and label in place, without changing width.
 */
export function RelationshipActions({ handle, name, relationship, url }: RelationshipActionsProps) {
  const t = useTranslations('web.network.relationship');
  const announce = useAnnounce();
  const message = useProblemMessage();
  const { relationship: current, pending, run } = useRelationship(handle, relationship);
  const [dialog, setDialog] = useState<'connect' | 'withdraw' | 'remove' | null>(null);

  /** A change of the api, said once it is done; a refusal is said and the state comes back. */
  async function act(action: RelationshipAction, call: () => Promise<unknown>, done: string) {
    try {
      await run(action, call);
      announce(done);
    } catch (error) {
      notify.error(message(error));
    }
  }

  const requestId = current.requestId ?? '';
  const step: ConnectionStep =
    current.connection === 'connected'
      ? 'connected'
      : current.connection === 'request_sent'
        ? 'pending'
        : 'connect';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {current.connection === 'request_received' ? (
        <>
          <Button
            loading={pending === 'accept'}
            loadingLabel={t('accepting')}
            aria-label={t('acceptName', { name })}
            onClick={() =>
              void act(
                { kind: 'accept' },
                () => connectionsControllerAccept(requestId),
                t('accepted', { name }),
              )
            }
          >
            <Check aria-hidden />
            {t('accept')}
          </Button>
          <Button
            variant="outline"
            loading={pending === 'decline'}
            loadingLabel={t('declining')}
            aria-label={t('declineName', { name })}
            onClick={() =>
              void act(
                { kind: 'decline' },
                () => connectionsControllerDecline(requestId),
                t('declined'),
              )
            }
          >
            {t('decline')}
          </Button>
        </>
      ) : (
        <Button
          variant={step === 'connect' ? 'primary' : step === 'pending' ? 'outline' : 'secondary'}
          aria-label={t(`${step}Name`, { name })}
          data-connection={step}
          onClick={() =>
            setDialog(step === 'connect' ? 'connect' : step === 'pending' ? 'withdraw' : 'remove')
          }
        >
          <IconSwap
            state={step}
            icons={{
              connect: <UserPlus aria-hidden />,
              pending: <Clock aria-hidden />,
              connected: <Users aria-hidden />,
            }}
          />
          <LabelSwap
            state={step}
            labels={{ connect: t('connect'), pending: t('pending'), connected: t('connected') }}
          />
        </Button>
      )}
      <Button
        variant="outline"
        aria-pressed={current.following}
        aria-label={t(current.following ? 'unfollowName' : 'followName', { name })}
        onClick={() =>
          void (current.following
            ? act(
                { kind: 'unfollow' },
                () => followsControllerUnfollow('member', handle),
                t('unfollowed', { name }),
              )
            : act(
                { kind: 'follow' },
                () => followsControllerFollow('member', handle),
                t('followed', { name }),
              ))
        }
      >
        <IconSwap
          state={current.following ? 'following' : 'follow'}
          icons={{ follow: <UserPlus aria-hidden />, following: <UserCheck aria-hidden /> }}
        />
        <LabelSwap
          state={current.following ? 'following' : 'follow'}
          labels={{ follow: t('follow'), following: t('unfollow') }}
        />
      </Button>
      <RelationshipMenu handle={handle} name={name} url={url} />
      <AlertDialog
        open={dialog === 'withdraw'}
        onOpenChange={(open) => setDialog(open ? 'withdraw' : null)}
        title={t('withdrawTitle', { name })}
        description={t('withdrawDescription')}
        confirmLabel={t('withdraw')}
        tone="primary"
        onConfirm={() =>
          act({ kind: 'withdraw' }, () => connectionsControllerWithdraw(requestId), t('withdrawn'))
        }
      />
      <AlertDialog
        open={dialog === 'remove'}
        onOpenChange={(open) => setDialog(open ? 'remove' : null)}
        title={t('removeTitle', { name })}
        description={t('removeDescription', { name })}
        confirmLabel={t('remove')}
        onConfirm={() =>
          act({ kind: 'remove' }, () => connectionsControllerRemove(handle), t('removed', { name }))
        }
      />
      {dialog === 'connect' ? (
        <Suspense fallback={null}>
          <ConnectDialog handle={handle} name={name} run={run} onClose={() => setDialog(null)} />
        </Suspense>
      ) : null}
    </div>
  );
}
