'use client';

import { lazy, type ReactNode, Suspense, useState } from 'react';
import { SendAsMessageContext } from '@/lib/actions/send-as-message';

/** The dialog of the messaging feature loads with its first opening, never with the shell. */
const loadShare = () =>
  import('@/features/messaging').then((module) => ({ default: module.ShareDialog }));
const ShareDialog = lazy(loadShare);

/**
 * « Envoyer en message » for the publications of the member space (§10.3): the menu of a
 * publication opens it through SendAsMessageContext (ADR 0094: nothing of the messaging in the
 * first load of the feed).
 */
export function SendAsMessageHost({ children }: { children: ReactNode }) {
  const [postId, setPostId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <SendAsMessageContext
      value={(id) => {
        void loadShare();
        setPostId(id);
        setOpen(true);
      }}
    >
      {children}
      {postId ? (
        <Suspense fallback={null}>
          <ShareDialog key={postId} postId={postId} open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </SendAsMessageContext>
  );
}
