'use client';

import { createContext, type ReactNode, use, useCallback, useRef, useState } from 'react';

type Announce = (message: string, politeness?: 'polite' | 'assertive') => void;

const AnnouncerContext = createContext<Announce>(() => undefined);

/**
 * Two live regions shared by a shell (`polite` and `assertive`): a counter that changes, a
 * reconnection, a page that loaded. The same message twice in a row is announced twice.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState({ polite: '', assertive: '' });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const announce = useCallback<Announce>((message, politeness = 'polite') => {
    clearTimeout(timer.current);
    setMessages((current) => ({ ...current, [politeness]: '' }));
    // Emptied first, then set: screen readers announce a change, not a value.
    timer.current = setTimeout(
      () => setMessages((current) => ({ ...current, [politeness]: message })),
      60,
    );
  }, []);
  return (
    <AnnouncerContext value={announce}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-announcer="polite">
        {messages.polite}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true" data-announcer="assertive">
        {messages.assertive}
      </div>
    </AnnouncerContext>
  );
}

/** Says a message through the live regions of the shell (AnnouncerProvider). */
export function useAnnounce(): Announce {
  return use(AnnouncerContext);
}
