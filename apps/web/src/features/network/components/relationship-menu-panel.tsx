'use client';

import { Ban, Link2, MoreHorizontal, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';

/**
 * The menu of « Plus d'actions » on a member, loaded after the first render by RelationshipMenu;
 * opened at once when it was asked for before it arrived.
 */
export function RelationshipMenuPanel({
  defaultOpen,
  label,
  canShare,
  onCopy,
  onShare,
  onBlock,
}: {
  defaultOpen: boolean;
  label: string;
  canShare: boolean;
  onCopy: () => void;
  onShare: () => void;
  onBlock: () => void;
}) {
  const t = useTranslations('web.network.menu');
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={label}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onCopy}>
          <Link2 aria-hidden />
          {t('copy')}
        </DropdownMenuItem>
        {canShare ? (
          <DropdownMenuItem onSelect={onShare}>
            <Share2 aria-hidden />
            {t('share')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={onBlock}>
          <Ban aria-hidden />
          {t('block')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
