'use client';

import type { DiscoveryCard } from '@pitchorium/contracts';
import { createContext, type ReactNode, use, useState } from 'react';
import { SuggestionActions } from './suggestion-actions';

const DismissContext = createContext<((hidden: boolean) => void) | null>(null);

/** An item of a grid of suggestions, that leaves it when its suggestion is dismissed. */
export function DismissibleItem({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  return (
    <DismissContext value={setHidden}>
      <li className="grid" hidden={hidden}>
        {children}
      </li>
    </DismissContext>
  );
}

/**
 * The actions of a profile suggested on « Découvrir »: « Se connecter » and « Pas intéressé »;
 * a dismissed card leaves its grid, and comes back if the toast undoes it.
 */
export function SuggestedProfileActions({ candidate }: { candidate: DiscoveryCard }) {
  const setHidden = use(DismissContext);
  return (
    <SuggestionActions
      candidate={candidate}
      onDismissed={() => setHidden?.(true)}
      onRestored={() => setHidden?.(false)}
    />
  );
}
