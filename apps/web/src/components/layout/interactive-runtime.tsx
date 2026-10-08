import type { ReactNode } from 'react';
import { MotionProvider } from '@/components/motion';
import { Toaster } from '@/components/ui';
import { type MessageScope } from '@/lib/i18n/messages';
import { requestNonce } from '@/lib/security/nonce';
import { ScopedMessages } from './scoped-messages';

/**
 * Client runtime of an interactive group (member space, administration, authentication, public
 * pages): its messages, the Motion features and the toasts. The editorial pages do without it
 * (ADR 0094).
 */
export async function InteractiveRuntime({
  scope,
  children,
}: {
  scope: MessageScope;
  children: ReactNode;
}) {
  const nonce = await requestNonce();
  return (
    <ScopedMessages scope={scope}>
      <MotionProvider nonce={nonce}>
        {children}
        <Toaster />
      </MotionProvider>
    </ScopedMessages>
  );
}
