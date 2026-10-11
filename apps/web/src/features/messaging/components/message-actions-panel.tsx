'use client';

import { messagingControllerEdit, messagingControllerRemove } from '@pitchorium/api-client';
import type { Message } from '@pitchorium/contracts';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  Button,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  notify,
  Textarea,
} from '@/components/ui';
import { useMessagingProblem } from '../hooks/use-messaging-problem';
import { MESSAGING_LIMITS } from '../lib/limits';

export interface MessageActionsProps {
  message: Message;
  /** The message as the api gives it back (edited, or a tombstone). */
  onChange: (message: Message) => void;
  defaultOpen?: boolean;
  focusTrigger?: boolean;
}

/**
 * Actions of a message of the reader (§10.4): edit it while the window the api gives lasts
 * (`editableUntil`, never computed here), or delete it after a confirmation, which leaves a
 * tombstone in the thread of everyone.
 */
export function MessageActionsPanel({
  message,
  onChange,
  defaultOpen = false,
  focusTrigger = false,
}: MessageActionsProps) {
  const t = useTranslations('web.messaging');
  const problem = useMessagingProblem();
  const now = useNow({ updateInterval: 30_000 });
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, [focusTrigger]);
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const [text, setText] = useState(message.body ?? '');
  const [saving, setSaving] = useState(false);
  const editable =
    message.editableUntil !== null &&
    message.body !== null &&
    Date.parse(message.editableUntil) > now.getTime();

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await messagingControllerEdit(message.conversationId, message.id, { body: text.trim() });
      onChange({ ...message, body: text.trim(), edited: true, editedAt: new Date().toISOString() });
      setDialog(null);
    } catch (error) {
      notify.error(problem(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton
            ref={trigger}
            label={t('messageActions')}
            icon={<MoreHorizontal />}
            size="sm"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {editable ? (
            <DropdownMenuItem
              onSelect={() => {
                setText(message.body ?? '');
                setDialog('edit');
              }}
            >
              <Pencil aria-hidden />
              {t('edit')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem tone="danger" onSelect={() => setDialog('delete')}>
            <Trash2 aria-hidden />
            {t('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={dialog === 'edit'} onOpenChange={(open) => setDialog(open ? 'edit' : null)}>
        <DialogContent
          title={t('editTitle')}
          size="sm"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>
                {t('cancel')}
              </Button>
              <Button loading={saving} loadingLabel={t('saving')} onClick={() => void save()}>
                {t('save')}
              </Button>
            </div>
          }
        >
          <Textarea
            aria-label={t('editLabel')}
            minRows={2}
            maxRows={8}
            maxLength={MESSAGING_LIMITS.body}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        title={t('deleteTitle')}
        description={t('deleteBody')}
        confirmLabel={t('deleteConfirm')}
        onConfirm={async () => {
          try {
            await messagingControllerRemove(message.conversationId, message.id);
            onChange({
              ...message,
              body: null,
              attachments: [],
              sharedPost: null,
              deleted: true,
              editableUntil: null,
            });
          } catch (error) {
            notify.error(problem(error));
          }
        }}
      />
    </>
  );
}
