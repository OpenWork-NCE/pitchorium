'use client';

import type { CountersDtoOutput } from '@pitchorium/api-client';
import { Menu } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { preloadWhenIdle } from '@/lib/preload';

/** The panel (vaul) and its content stay out of the first load; they arrive when the page is idle. */
const loadPanel = () => import('./mobile-menu-panel');
const MobileMenuPanel = dynamic(loadPanel, { ssr: false });

/**
 * Menu button of a narrow screen: the sections not in the header, the followed projects, the
 * action of the context and the account in a panel pulled from the bottom (§6.1: the same
 * information, stacked).
 */
export function MobileMenu({
  counters,
  label,
}: {
  counters: CountersDtoOutput | undefined;
  label: string;
}) {
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
        aria-label={label}
        onClick={() => {
          setUsed(true);
          setOpen(true);
        }}
      >
        <Menu aria-hidden />
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
