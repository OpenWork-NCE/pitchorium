'use client';

import { messagingControllerStart } from '@pitchorium/api-client';
import type { MemberCard, MessagingWithMember } from '@pitchorium/contracts';
import { ArrowLeft, Inbox, ShieldOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Avatar, Button, Callout, EmptyState, IconButton } from '@/components/ui';
import { routes } from '@/config/routes';
import { useWithPrerequisites } from '@/features/access';
import { Link, useRouter } from '@/i18n/navigation';
import { useMessagingProblem } from '../hooks/use-messaging-problem';
import type { MessageContent } from '../hooks/use-send-message';
import { newClientMessageId } from '../lib/thread';
import { LazyMessageComposer } from './lazy-composer';

/**
 * A first message to a member (§10.4, §7.2), before the conversation exists: what the api says
 * it will be, out of network a request the member must accept first (the interface says it), or
 * refused by the preference of the member. The prerequisites (verified email, minimum profile)
 * open their forms at the first send, then the send goes again (ADR 0105). Once sent, the
 * conversation opens at its own address.
 */
export function NewConversation({
  member,
  availability,
  sharedPostId,
}: {
  member: MemberCard;
  availability: MessagingWithMember;
  /** A publication sent as a message (« Envoyer en message »). */
  sharedPostId?: string | undefined;
}) {
  const t = useTranslations('web.messaging.new');
  const messaging = useTranslations('web.messaging');
  const router = useRouter();
  const problem = useMessagingProblem();
  const withPrerequisites = useWithPrerequisites();
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // One intention, one key and one client id: a new attempt never sends twice.
  const [intent] = useState(() => ({
    key: crypto.randomUUID(),
    clientMessageId: newClientMessageId(),
  }));

  async function send(content: MessageContent) {
    setSending(true);
    setFailure(null);
    try {
      const message = await withPrerequisites(() =>
        messagingControllerStart(
          {
            recipientHandle: member.handle,
            clientMessageId: intent.clientMessageId,
            body: content.body,
            attachmentIds: content.attachments.map((attachment) => attachment.mediaId),
            attachmentTexts: content.attachments.map((attachment) => attachment.text),
            ...(sharedPostId ? { sharedPostId } : {}),
          },
          { headers: { 'Idempotency-Key': intent.key } },
        ),
      );
      router.replace(routes.conversation(message.conversationId));
    } catch (error) {
      setFailure(problem(error));
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="new-conversation" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
        <IconButton
          className="lg:hidden"
          label={messaging('thread.back')}
          icon={<ArrowLeft />}
          link={<Link href={routes.messages} />}
        />
        <Avatar name={member.displayName} src={member.avatarUrl} size="md" decorative />
        <div className="grid min-w-0 flex-1">
          <h2 id="new-conversation" className="truncate text-base font-semibold text-foreground">
            <Link href={routes.member(member.handle)} className="hover:underline">
              {member.displayName}
            </Link>
          </h2>
          {member.headline ? (
            <p className="truncate text-xs text-muted">{member.headline}</p>
          ) : null}
        </div>
      </header>
      {availability.mode === 'refused' ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={<ShieldOff />}
            title={t('refusedTitle')}
            description={t('refusedBody', { name: member.displayName })}
            action={
              <Button asChild variant="secondary">
                <Link href={routes.member(member.handle)}>{t('profile')}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid flex-1 content-end gap-3 overflow-y-auto p-4">
            {availability.mode === 'request' ? (
              <Callout icon={<Inbox />} title={t('requestTitle')}>
                {t('requestBody', { name: member.displayName })}
              </Callout>
            ) : (
              <p className="text-center text-sm text-muted">
                {t('directBody', { name: member.displayName })}
              </p>
            )}
            {sharedPostId ? <p className="text-center text-sm text-muted">{t('sharing')}</p> : null}
            {failure ? (
              <p role="alert" className="text-center text-sm text-danger">
                {failure}
              </p>
            ) : null}
          </div>
          <div className="border-t border-border p-3">
            <LazyMessageComposer
              onSend={(content) => void send(content)}
              disabledReason={sending ? t('sending') : undefined}
            />
          </div>
        </>
      )}
    </section>
  );
}
