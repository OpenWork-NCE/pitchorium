'use client';

import type { CountersDtoOutput } from '@pitchorium/api-client';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Button, CountBadge } from '@/components/ui';
import { preloadWhenIdle } from '@/lib/preload';

/** The panel (vaul) and its content stay out of the first load; they arrive when the page is idle. */
const loadPanel = () => import('./mobile-menu-panel');
const MobileMenuPanel = dynamic(loadPanel, { ssr: false });

/**
 * Menu button of a narrow screen: the sections, the action of the context and the account in a
 * panel pulled from the bottom (§6.1: the same information, stacked). Says what is to handle.
 */
export function MobileMenu({
  counters,
  total,
  label,
}: {
  counters: CountersDtoOutput | undefined;
  total: number;
  label: string;
}) {
  const t = useTranslations('web.nav');
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => preloadWhenIdle(loadPanel), []);
  return (
    <>
      <Button
        ref={button}
        variant="ghost"
        size="icon"
        className="relative lg:hidden"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={total > 0 ? t('menuWithCount', { count: total }) : label}
        onClick={() => {
          setUsed(true);
          setOpen(true);
        }}
      >
        <Menu aria-hidden />
        <CountBadge count={total} className="absolute top-1 right-1" />
      </Button>
      {used ? (
        <MobileMenuPanel
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            // The panel was not opened by its own trigger: the focus goes back to the button.
            if (!next) requestAnimationFrame(() => button.current?.focus());
          }}
          counters={counters}
          label={label}
        />
      ) : null}
    </>
  );
}
