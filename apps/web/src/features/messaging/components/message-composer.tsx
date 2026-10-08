'use client';

import { Paperclip, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useId, useRef, useState } from 'react';
import { IconButton, Textarea } from '@/components/ui';

interface MessageComposerProps {
  onSend: (text: string) => void;
  /** Files chosen to attach (sent through features/media). */
  onAttach?: (files: File[]) => void;
  /** Why nothing can be sent (a request waiting for its answer, a block). */
  disabledReason?: string;
}

/**
 * Field to write a message: it grows with its text (six lines at most, then scrolls), a button
 * attaches files, Enter adds a line and the send button (or Ctrl Enter, Cmd Enter) sends.
 */
export function MessageComposer({ onSend, onAttach, disabledReason }: MessageComposerProps) {
  const t = useTranslations('web.messaging');
  const [text, setText] = useState('');
  const files = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  function send(event?: FormEvent) {
    event?.preventDefault();
    if (disabledReason || !text.trim()) return;
    onSend(text.trim());
    setText('');
  }

  return (
    <form onSubmit={send} className="flex items-end gap-2">
      <input
        ref={files}
        id={fileInputId}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          onAttach?.([...(event.target.files ?? [])]);
          event.target.value = '';
        }}
      />
      <IconButton
        label={t('attach')}
        icon={<Paperclip />}
        disabledReason={disabledReason}
        onClick={() => files.current?.click()}
      />
      <Textarea
        aria-label={t('message')}
        placeholder={t('placeholder')}
        minRows={1}
        maxRows={6}
        value={text}
        disabled={Boolean(disabledReason)}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) send();
        }}
        className="flex-1"
      />
      <IconButton
        label={t('send')}
        icon={<Send />}
        variant="primary"
        type="submit"
        disabledReason={disabledReason}
      />
    </form>
  );
}
