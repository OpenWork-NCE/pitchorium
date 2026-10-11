'use client';

import { FileText, Paperclip, RotateCcw, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { IconButton, Input, ProgressRing, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  indexedDbMessageDraftStore,
  readMessageDraft,
  writeMessageDraft,
} from '@/lib/drafts/message-drafts';
import { ATTACHMENT_TYPES, useAttachments } from '../hooks/use-attachments';
import type { MessageContent } from '../hooks/use-send-message';
import { MESSAGING_LIMITS } from '../lib/limits';

/** A touch screen has a send button and no Enter to send (§10.4). */
function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(pointer: coarse)');
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );
}

interface MessageComposerProps {
  onSend: (content: MessageContent) => void;
  /** Why nothing can be sent (a request waiting for its answer, a block). */
  disabledReason?: string | undefined;
  /** The draft of this conversation, kept on the device for this member (ADR 0147). */
  draft?: { memberId: string; conversationId: string } | undefined;
  /** Each keystroke: the typing indicator of the others (throttled by the caller). */
  onTyping?: () => void;
  /** Files may be attached (not in a first message out of network, for example). */
  attachments?: boolean;
}

/**
 * Field to write a message (§10.4): it grows with its text (six lines, then scrolls). On a
 * computer Enter sends and Shift Enter adds a line; on a touch screen Enter adds a line and the
 * send button sends. Images (made lighter) and PDF are attached with their text alternative or
 * title; the text is kept per conversation on the device until it is sent.
 */
export function MessageComposer({
  onSend,
  disabledReason,
  draft,
  onTyping,
  attachments: allowAttachments = true,
}: MessageComposerProps) {
  const t = useTranslations('web.messaging');
  const rejections = useTranslations('reference.mediaRejectionReasons');
  const [text, setText] = useState('');
  const [tooMany, setTooMany] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const hintId = useId();
  const coarse = useCoarsePointer();
  const attachments = useAttachments();
  const loaded = useRef<string | null>(null);

  const draftKey = draft ? `${draft.memberId}:${draft.conversationId}` : null;
  // The draft of the conversation comes back when it opens.
  useEffect(() => {
    if (!draft || loaded.current === draftKey) return;
    loaded.current = draftKey;
    let live = true;
    void readMessageDraft(indexedDbMessageDraftStore, draft.memberId, draft.conversationId).then(
      (saved) => {
        if (live && saved) setText((current) => current || saved);
      },
    );
    return () => {
      live = false;
    };
  }, [draft, draftKey]);
  // Written while typing, a moment after the last key.
  useEffect(() => {
    if (!draft || loaded.current !== draftKey) return;
    const timer = setTimeout(() => {
      void writeMessageDraft(
        indexedDbMessageDraftStore,
        draft.memberId,
        draft.conversationId,
        text,
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [text, draft, draftKey]);

  const ready = attachments.ready;
  const canSend =
    !disabledReason && !attachments.pending && (text.trim().length > 0 || ready.length > 0);

  function send(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    onSend({
      body: text.trim(),
      attachments: ready.map((item) => ({
        mediaId: item.mediaId!,
        text: item.text.trim(),
        previewUrl: item.previewUrl,
      })),
    });
    setText('');
    attachments.clear();
    setTooMany(false);
    if (draft) {
      void writeMessageDraft(indexedDbMessageDraftStore, draft.memberId, draft.conversationId, '');
    }
  }

  return (
    <form onSubmit={send} className="grid gap-2" aria-label={t('composer')}>
      {attachments.items.length > 0 ? (
        <ul className="grid gap-2" aria-label={t('attachmentsLabel')}>
          {attachments.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-surface-sunken p-2"
              data-state={item.state}
            >
              <span className="relative inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface text-muted">
                {item.previewUrl ? (
                  // A local preview (object URL) of the chosen file.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt="" className="size-full object-cover" />
                ) : (
                  <FileText aria-hidden className="size-6" />
                )}
                {['compressing', 'sending', 'checking'].includes(item.state) ? (
                  <span className="absolute inset-0 inline-flex items-center justify-center bg-surface/70">
                    <ProgressRing
                      value={item.state === 'sending' ? item.progress : null}
                      label={t(`attachment.${item.state === 'sending' ? 'sending' : 'checking'}`)}
                    />
                  </span>
                ) : null}
              </span>
              <div className="grid min-w-0 flex-1 gap-1">
                <Input
                  aria-label={t(item.kind === 'image' ? 'attachment.alt' : 'attachment.title', {
                    name: item.name,
                  })}
                  placeholder={t(
                    item.kind === 'image'
                      ? 'attachment.altPlaceholder'
                      : 'attachment.titlePlaceholder',
                  )}
                  value={item.text}
                  maxLength={MESSAGING_LIMITS.attachmentText}
                  onChange={(event) => attachments.setText(item.id, event.target.value)}
                />
                {item.state === 'rejected' && item.reason ? (
                  <p className="text-xs text-danger">
                    {rejections.has(item.reason as never)
                      ? rejections(item.reason as never)
                      : t('attachment.failed')}
                  </p>
                ) : item.state === 'failed' ? (
                  <p className="text-xs text-danger">{t('attachment.failed')}</p>
                ) : null}
              </div>
              {item.state === 'failed' ? (
                <IconButton
                  size="sm"
                  label={t('attachment.retry', { name: item.name })}
                  icon={<RotateCcw />}
                  onClick={() => attachments.retry(item.id)}
                />
              ) : null}
              <IconButton
                size="sm"
                label={t('attachment.remove', { name: item.name })}
                icon={<X />}
                onClick={() => attachments.remove(item.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {tooMany ? (
        <p className="text-xs text-danger" role="status">
          {t('attachment.tooMany', { count: MESSAGING_LIMITS.attachments })}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        {allowAttachments ? (
          <>
            <input
              ref={files}
              id={fileInputId}
              type="file"
              accept={ATTACHMENT_TYPES}
              multiple
              hidden
              onChange={(event) => {
                setTooMany(attachments.add([...(event.target.files ?? [])]) > 0);
                event.target.value = '';
              }}
            />
            <IconButton
              label={t('attach')}
              icon={<Paperclip />}
              disabledReason={disabledReason}
              onClick={() => files.current?.click()}
            />
          </>
        ) : null}
        <Textarea
          aria-label={t('message')}
          aria-describedby={coarse ? undefined : hintId}
          placeholder={t('placeholder')}
          minRows={1}
          maxRows={6}
          maxLength={MESSAGING_LIMITS.body}
          value={text}
          disabled={Boolean(disabledReason)}
          enterKeyHint={coarse ? 'enter' : 'send'}
          onChange={(event) => {
            setText(event.target.value);
            onTyping?.();
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            // A computer sends with Enter (a line with Shift); a touch screen with its button.
            if (!coarse && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          className="flex-1"
        />
        <IconButton
          label={t('send')}
          icon={<Send />}
          variant="primary"
          type="submit"
          disabledReason={disabledReason ?? (canSend ? undefined : t('sendDisabled'))}
        />
      </div>
      <p id={hintId} className={cn('text-xs text-muted', coarse && 'sr-only')}>
        {t('enterHint')}
      </p>
    </form>
  );
}
