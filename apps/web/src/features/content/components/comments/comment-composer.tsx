'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button, Field } from '@/components/ui';
import { LIMITS } from '../../lib/limits';
import { MentionTextarea } from '../mentions/mention-textarea';

/**
 * Writing a comment or a reply (§10.3): a text area with the mentions, its counter near the
 * limit, « Publier » (or Ctrl Enter); the text stays if the api refuses, with the reason.
 */
export function CommentComposer({
  label,
  submitLabel,
  initial = '',
  focusOnMount = false,
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  initial?: string;
  /** The text area takes the focus when it appears (a reply, an edition asked for). */
  focusOnMount?: boolean;
  /** Resolves once sent; rejects with the error to say. */
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const t = useTranslations('web.content.commentsThread');
  const [text, setText] = useState(initial);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!focusOnMount) return;
    const area = form.current?.querySelector('textarea');
    area?.focus();
    area?.setSelectionRange(area.value.length, area.value.length);
  }, [focusOnMount]);
  const [sending, setSending] = useState(false);
  const trimmed = text.trim();
  const submit = async () => {
    if (!trimmed || trimmed.length > LIMITS.commentText || sending) return;
    setSending(true);
    try {
      await onSubmit(trimmed);
      setText('');
    } catch {
      // The caller said why; the text stays to be sent again.
    } finally {
      setSending(false);
    }
  };
  return (
    <form
      ref={form}
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field label={label} hideLabel counter={{ count: text.length, max: LIMITS.commentText }}>
        <MentionTextarea
          value={text}
          onChange={setText}
          onSubmit={() => void submit()}
          placeholder={t('placeholder')}
          minRows={1}
          maxRows={8}
        />
      </Field>
      {trimmed || onCancel ? (
        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t('cancel')}
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            loading={sending}
            disabled={!trimmed || trimmed.length > LIMITS.commentText}
          >
            {submitLabel}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
