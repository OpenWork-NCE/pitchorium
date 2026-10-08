'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { type MouseEvent, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { cssEase, DURATION_MS, IconSwap, useMotionPreference } from '@/components/motion';
import { Button } from '@/components/ui';

type Theme = 'light' | 'dark';

const subscribeNothing = () => () => {};

/** False during the server render and the hydration: the theme is only known in the browser. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/**
 * Light and dark switch (H14, level 3): the new theme grows as a circle from the button through
 * the View Transitions API; a plain fade with less motion; an instant switch without the API.
 */
export function ThemeToggle() {
  const t = useTranslations('web.theme');
  const { resolvedTheme, setTheme } = useTheme();
  const reduced = useMotionPreference() === 'reduced';
  const hydrated = useHydrated();
  const current: Theme = hydrated && resolvedTheme === 'dark' ? 'dark' : 'light';

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    const apply = () => {
      // Applied at once in the DOM so that the transition captures the new state.
      root.dataset.theme = next;
      root.style.colorScheme = next;
      setTheme(next);
    };
    if (!('startViewTransition' in document)) {
      apply();
      return;
    }
    root.dataset.themeTransition = reduced ? 'fade' : 'circle';
    const transition = document.startViewTransition(() => flushSync(apply));
    if (!reduced) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      void transition.ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          {
            duration: DURATION_MS.theme,
            easing: cssEase('curtain'),
            pseudoElement: '::view-transition-new(root)',
          },
        );
      });
    }
    void transition.finished.finally(() => {
      delete root.dataset.themeTransition;
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={current === 'dark' ? t('toLight') : t('toDark')}
      data-theme-state={current}
    >
      <IconSwap state={current} icons={{ light: <Sun />, dark: <Moon /> }} />
    </Button>
  );
}
