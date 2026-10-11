import { messagingControllerGet, messagingControllerMessages } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ConversationView, THREAD_PAGE_SIZE } from '@/features/messaging';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.messaging');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * A conversation (§10.4): its state and its latest messages read by the server; the browser then
 * keeps it by the realtime channel. One the member no longer sees (a block, a declined request)
 * gives a neutral explanation in the page.
 */
export default async function Page({ params }: PageProps<'/[locale]/messages/[conversationId]'>) {
  const { locale, conversationId } = await params;
  setRequestLocale(asLocale(locale));
  if (!UUID.test(conversationId)) notFound();
  configureServerApi();
  const [conversation, messages] = await Promise.all([
    messagingControllerGet(conversationId, { cache: 'no-store' }).catch(() => null),
    messagingControllerMessages(
      conversationId,
      { limit: THREAD_PAGE_SIZE },
      { cache: 'no-store' },
    ).catch(() => null),
  ]);
  return (
    <ConversationView
      key={conversationId}
      conversationId={conversationId}
      initialConversation={conversation}
      initialMessages={messages}
    />
  );
}
