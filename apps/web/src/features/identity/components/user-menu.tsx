'use client';

import { type ComponentType, useCallback, useEffect, useRef, useState } from 'react';
import { preloadWhenIdle } from '@/lib/preload';
import { AccountButton } from './account-button';
import type { UserMenuPanel } from './user-menu-panel';

/** The menu (Radix DropdownMenu and its positioning) stays out of the first load (ADR 0094). */
const loadPanel = () => import('./user-menu-panel');

/**
 * Menu of the account: the avatar renders first as a plain button; the menu loads when the page
 * is idle or at the first use, then takes its place. A use before it arrived opens it once
 * loaded.
 */
export function UserMenu() {
  const [Panel, setPanel] = useState<ComponentType<Parameters<typeof UserMenuPanel>[0]> | null>(
    null,
  );
  const [request, setRequest] = useState({ open: false, keyboard: false });
  const focused = useRef(false);
  const load = useCallback(
    () => loadPanel().then((module) => setPanel(() => module.UserMenuPanel)),
    [],
  );
  useEffect(() => preloadWhenIdle(load), [load]);

  if (Panel)
    return <Panel defaultOpen={request.open} keyboard={request.keyboard} focused={focused} />;
  const open = (keyboard: boolean) => {
    setRequest({ open: true, keyboard });
    void load().catch(() => undefined);
  };
  return (
    <AccountButton
      aria-haspopup="menu"
      aria-expanded={false}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
      }}
      // Enter and Space click with no pointer (detail 0).
      onClick={(event) => open(event.detail === 0)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        open(true);
      }}
    />
  );
}
