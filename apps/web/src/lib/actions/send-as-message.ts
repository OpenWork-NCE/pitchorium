'use client';

import { createContext, use } from 'react';

/**
 * « Envoyer en message » of a publication (§10.3): the member shell provides it (the dialog of
 * the messaging feature), the menu of a publication calls it. A context of its own, so that the
 * content feature never imports the messaging feature (which shows publications in messages).
 */
export const SendAsMessageContext = createContext<((postId: string) => void) | null>(null);

/** Opens the choice of a conversation or a connection; null outside the member space. */
export function useSendAsMessage(): ((postId: string) => void) | null {
  return use(SendAsMessageContext);
}
