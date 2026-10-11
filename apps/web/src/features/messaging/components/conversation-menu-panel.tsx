'use client';

import type { Conversation } from '@pitchorium/contracts';
import { Archive, ArchiveRestore, Bell, BellOff, LogOut, Mail, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  notify,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useRouter } from '@/i18n/navigation';
import { useMessagingProblem } from '../hooks/use-messaging-problem';

export interface ConversationMenuProps {
  conversation: Conversation;
  update: (change: { archived?: boolean; muted?: boolean; unread?: boolean }) => Promise<unknown>;
  leave: () => Promise<void>;
  defaultOpen?: boolean;
  focusTrigger?: boolean;
}

/**
 * Actions of a conversation for the member alone (§10.4): archive or bring back, mute or not,
 * mark unread (back to the list), and leave a group born of an introduction after a confirmation.
 */
export function ConversationMenuPanel({
  conversation,
  update,
  leave,
  defaultOpen = false,
  focusTrigger = false,
}: ConversationMenuProps) {
  const t = useTranslations('web.messaging.thread');
  const problem = useMessagingProblem();
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, [focusTrigger]);

  const run = (action: () => Promise<unknown>, done: string) =>
    void action().then(
      () => notify.success(done),
      (error: unknown) => notify.error(problem(error)),
    );

  return (
    <>
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton ref={trigger} label={t('actions')} icon={<MoreHorizontal />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              run(
                () => update({ archived: !conversation.archived }),
                conversation.archived ? t('unarchived') : t('archived'),
              )
            }
          >
            {conversation.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {conversation.archived ? t('unarchive') : t('archive')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              run(
                () => update({ muted: !conversation.muted }),
                conversation.muted ? t('unmuted') : t('muted'),
              )
            }
          >
            {conversation.muted ? <Bell aria-hidden /> : <BellOff aria-hidden />}
            {conversation.muted ? t('unmute') : t('mute')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              void update({ unread: true }).then(
                () => router.push(routes.messages),
                (error: unknown) => notify.error(problem(error)),
              )
            }
          >
            <Mail aria-hidden />
            {t('markUnread')}
          </DropdownMenuItem>
          {conversation.kind === 'group' ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={() => setLeaving(true)}>
                <LogOut aria-hidden />
                {t('leave')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {conversation.kind === 'group' ? (
        <AlertDialog
          open={leaving}
          onOpenChange={setLeaving}
          title={t('leaveTitle')}
          description={t('leaveBody')}
          confirmLabel={t('leaveConfirm')}
          onConfirm={async () => {
            try {
              await leave();
              router.push(routes.messages);
            } catch (error) {
              notify.error(problem(error));
            }
          }}
        />
      ) : null}
    </>
  );
}
