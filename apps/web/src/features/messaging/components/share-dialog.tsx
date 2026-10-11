'use client';

import {
  messagingControllerList,
  messagingControllerSend,
  messagingControllerStart,
} from '@pitchorium/api-client';
import type { Conversation, CursorPage } from '@pitchorium/contracts';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import {
  Button,
  Combobox,
  Dialog,
  DialogContent,
  Field,
  FormActions,
  notify,
  Textarea,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { useWithPrerequisites } from '@/features/access';
import { useRouter } from '@/i18n/navigation';
import { formatNames } from '@/lib/format/list';
import { useMessagingProblem } from '../hooks/use-messaging-problem';
import { useMyConnections } from '../hooks/use-my-connections';
import { MESSAGING_LIMITS } from '../lib/limits';
import { newClientMessageId } from '../lib/thread';

/**
 * « Envoyer en message » (§10.3): the publication goes as a card into a conversation of the
 * member or to one of their connections, with a word if they like. The api checks that the
 * sender sees the publication; each reader then sees it as their audience allows.
 */
export default function ShareDialog({
  postId,
  open,
  onOpenChange,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('web.messaging.share');
  const locale = useLocale();
  const router = useRouter();
  const problem = useMessagingProblem();
  const withPrerequisites = useWithPrerequisites();
  const connections = useMyConnections(open);
  const conversations = useQuery({
    queryKey: ['messaging', 'share-targets'],
    queryFn: ({ signal }) =>
      messagingControllerList({ box: 'inbox', limit: 20 }, { signal }) as Promise<
        CursorPage<Conversation>
      >,
    enabled: open,
  });
  const [target, setTarget] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [intent] = useState(() => ({ key: crypto.randomUUID(), id: newClientMessageId() }));

  const fromConversations = (conversations.data?.items ?? [])
    .filter((conversation) => conversation.canSend)
    .map((conversation) => ({
      value: `conversation:${conversation.id}`,
      label: formatNames(
        conversation.participants
          .filter((participant) => !participant.left)
          .map((participant) => participant.member.displayName),
        locale,
      ),
      hint: t('conversation'),
    }));
  const inConversation = new Set(
    (conversations.data?.items ?? [])
      .filter((conversation) => conversation.kind === 'direct')
      .flatMap((conversation) => conversation.participants.map((p) => p.member.handle)),
  );
  const fromConnections = (connections.data ?? [])
    .filter((card) => !inConversation.has(card.handle))
    .map((card) => ({
      value: `member:${card.handle}`,
      label: card.displayName,
      hint: card.headline ?? t('connection'),
    }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!target) {
      setError(t('targetRequired'));
      return;
    }
    setSending(true);
    setError(null);
    const [kind, id] = target.split(':') as ['conversation' | 'member', string];
    const content = { clientMessageId: intent.id, body: note.trim(), sharedPostId: postId };
    const headers = { headers: { 'Idempotency-Key': intent.key } };
    try {
      const message = await withPrerequisites(() =>
        kind === 'conversation'
          ? messagingControllerSend(id, content, headers)
          : messagingControllerStart({ ...content, recipientHandle: id }, headers),
      );
      notify.success(t('sent'));
      onOpenChange(false);
      if (kind === 'member') router.push(routes.conversation(message.conversationId));
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('title')} description={t('description')} size="md">
        <form onSubmit={(event) => void submit(event)} className="grid gap-5" noValidate>
          <Field label={t('target')} error={error && !target ? error : undefined} required>
            <Combobox
              options={[...fromConversations, ...fromConnections]}
              loading={conversations.isPending || connections.isPending}
              placeholder={t('targetPlaceholder')}
              value={target}
              onValueChange={setTarget}
            />
          </Field>
          <Field
            label={t('note')}
            optional
            counter={{ count: note.length, max: MESSAGING_LIMITS.body }}
          >
            <Textarea
              minRows={2}
              maxRows={6}
              maxLength={MESSAGING_LIMITS.body}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          {error && target ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <FormActions>
            <Button type="submit" loading={sending} loadingLabel={t('sending')}>
              {t('submit')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
