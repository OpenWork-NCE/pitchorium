'use client';

import { MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The two panels of the messaging (§10.4): on a computer the list and the conversation side by
 * side, the list kept while conversations change; on a phone the list, then the conversation at
 * its own address with a way back. The frame fills the height under the header, each panel
 * scrolls on its own.
 */
export function MessagesFrame({
  title,
  list,
  children,
}: {
  title: ReactNode;
  list: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations('web.messaging');
  const segment = useSelectedLayoutSegment();
  const open = segment !== null;
  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-0 sm:px-6 lg:py-6">
      <div className={cn('px-4 pt-4 sm:px-0 lg:pt-0', open && 'max-lg:sr-only')}>{title}</div>
      <div
        className={cn(
          'grid min-h-[28rem] grid-cols-1 overflow-hidden border-border bg-surface sm:rounded-xl sm:border',
          'h-[calc(100dvh-var(--header-height)-5.5rem)] lg:h-[calc(100dvh-var(--header-height)-8.5rem)]',
          'lg:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)]',
          open && 'max-lg:h-[calc(100dvh-var(--header-height))]',
        )}
      >
        <aside
          aria-label={t('list.title')}
          className={cn('min-h-0 min-w-0 border-border lg:border-r', open && 'max-lg:hidden')}
        >
          {list}
        </aside>
        <div className={cn('min-h-0 min-w-0', !open && 'max-lg:hidden')}>{children}</div>
      </div>
    </div>
  );
}

/** The conversation panel before a conversation is chosen (a computer only). */
export function NoConversation() {
  const t = useTranslations('web.messaging.thread');
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState icon={<MessageSquare />} title={t('choose')} description={t('chooseBody')} />
    </div>
  );
}
