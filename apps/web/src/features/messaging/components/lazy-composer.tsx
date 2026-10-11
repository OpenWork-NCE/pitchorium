'use client';

import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { FieldSkeleton } from '@/components/ui';

/** The place of the composer while it loads: same height, the field and its two buttons. */
function ComposerPlaceholder() {
  const t = useTranslations('web.messaging');
  return (
    <div className="grid gap-2">
      <div className="flex items-end gap-2">
        <span aria-hidden className="size-11 shrink-0 rounded-full bg-surface-sunken" />
        <FieldSkeleton hint={t('placeholder')} className="flex-1" />
        <span aria-hidden className="size-11 shrink-0 rounded-full bg-accent-subtle" />
      </div>
      <span aria-hidden className="h-4" />
    </div>
  );
}

/**
 * The composer of a conversation, loaded right after the page (ADR 0094: its files, its draft
 * and its icons stay out of the first load), in a place of the same height meanwhile.
 */
export const LazyMessageComposer = dynamic(
  () => import('./message-composer').then((module) => module.MessageComposer),
  { ssr: false, loading: ComposerPlaceholder },
);
