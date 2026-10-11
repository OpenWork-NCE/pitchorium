'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatNames } from '@/lib/format/list';

/**
 * Who is typing in the conversation (§10.4), ephemeral (never stored): three sober dots and the
 * sentence; with less motion the dots stay still and the sentence says it (motion.md). The place
 * is kept while nobody types, so the thread never jumps.
 */
export function TypingIndicator({ names }: { names: readonly string[] }) {
  const t = useTranslations('web.messaging');
  const locale = useLocale();
  const typing = names.length > 0;
  return (
    <p className="flex min-h-7 items-center gap-2 px-1 pt-2 text-xs text-muted" aria-live="polite">
      {typing ? (
        <>
          <span aria-hidden className="typing-dots inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-current" />
            <span className="size-1.5 rounded-full bg-current" />
            <span className="size-1.5 rounded-full bg-current" />
          </span>
          {names.length === 1
            ? t('typing.one', { name: formatNames(names, locale) })
            : t('typing.many', { names: formatNames(names, locale) })}
        </>
      ) : null}
    </p>
  );
}
