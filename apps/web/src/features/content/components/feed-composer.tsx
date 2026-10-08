'use client';

import { PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, Card } from '@/components/ui';
import { routes } from '@/config/routes';
import { useCurrentMember } from '@/features/identity';
import { Link } from '@/i18n/navigation';

/**
 * « Commencer une publication » at the top of the feed: the shell of the composer, which opens
 * the writing of a publication (the composer itself arrives with PROMPT FRONT 4).
 */
export function FeedComposer() {
  const t = useTranslations('web.feed');
  const member = useCurrentMember();
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <Avatar name={member.profile.displayName} src={member.profile.avatarUrl} decorative />
      <Link
        href={routes.compose}
        className="flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm text-muted outline-none hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="truncate">{t('compose')}</span>
        <PenLine aria-hidden className="size-4 shrink-0" />
      </Link>
    </Card>
  );
}
