import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { clientMessages, type MessageScope } from '@/lib/i18n/messages';

/**
 * Messages of a route group for its client components (CLIENT_MESSAGES): rendered by the server,
 * it replaces the messages of the document for the subtree, so that a page only serializes the
 * texts its group reads in the browser (ADR 0094).
 */
export async function ScopedMessages({
  scope,
  children,
}: {
  scope: MessageScope;
  children: ReactNode;
}) {
  const locale = await getLocale();
  return (
    <NextIntlClientProvider messages={clientMessages(locale, scope)}>
      {children}
    </NextIntlClientProvider>
  );
}
