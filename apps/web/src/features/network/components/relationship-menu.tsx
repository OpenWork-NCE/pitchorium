'use client';

import { blocksControllerBlock } from '@pitchorium/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentType, useCallback, useEffect, useState } from 'react';
import { AlertDialog, IconButton, notify } from '@/components/ui';
import { routes } from '@/config/routes';
import { useRouter } from '@/i18n/navigation';
import { preloadWhenIdle } from '@/lib/preload';
import type { RelationshipMenuPanel } from './relationship-menu-panel';
import { useProblemMessage } from './use-relationship';

/** The menu (Radix DropdownMenu) stays out of the first load: idle, or the first use (ADR 0094). */
const loadPanel = () => import('./relationship-menu-panel');

type Panel = ComponentType<Parameters<typeof RelationshipMenuPanel>[0]>;

/**
 * « Plus d'actions » on a member: copy the link of the profile, share it, block the member. The
 * button renders first; the menu loads when the page is idle or at the first use, then opens.
 * Blocking is confirmed with its effects, then the member disappears from the pages of the
 * reader at once (ADR 0029).
 */
export function RelationshipMenu({
  handle,
  name,
  url,
}: {
  handle: string;
  name: string;
  url: string;
}) {
  const t = useTranslations('web.network.menu');
  const queryClient = useQueryClient();
  const router = useRouter();
  const message = useProblemMessage();
  const [Menu, setMenu] = useState<Panel | null>(null);
  const [openOnLoad, setOpenOnLoad] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const load = useCallback(
    () => loadPanel().then((module) => setMenu(() => module.RelationshipMenuPanel)),
    [],
  );
  useEffect(() => preloadWhenIdle(load), [load]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      notify.success(t('copied'));
    } catch {
      notify.error(t('copyFailed'));
    }
  }

  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: name, url });
    } catch {
      // Closed by the person: nothing to say.
    }
  }

  async function block() {
    try {
      await blocksControllerBlock(handle);
    } catch (error) {
      notify.error(message(error));
      return;
    }
    // Nothing of the member may stay on screen: every cached read goes, then the feed.
    queryClient.clear();
    notify.success(t('blocked', { name }));
    router.replace(routes.feed);
    router.refresh();
  }

  const trigger = (
    <IconButton
      label={t('more', { name })}
      icon={<MoreHorizontal />}
      variant="outline"
      aria-haspopup="menu"
      onClick={() => {
        setOpenOnLoad(true);
        void load();
      }}
    />
  );

  return (
    <>
      {Menu ? (
        <Menu
          defaultOpen={openOnLoad}
          label={t('more', { name })}
          canShare={typeof navigator !== 'undefined' && 'share' in navigator}
          onCopy={() => void copy()}
          onShare={() => void share()}
          onBlock={() => setBlocking(true)}
        />
      ) : (
        trigger
      )}
      <AlertDialog
        open={blocking}
        onOpenChange={setBlocking}
        title={t('blockTitle', { name })}
        description={t('blockDescription', { name })}
        confirmLabel={t('blockConfirm', { name })}
        onConfirm={block}
      />
    </>
  );
}
