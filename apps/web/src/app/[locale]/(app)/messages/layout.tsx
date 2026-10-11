import { messagingControllerList } from '@pitchorium/api-client';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Main } from '@/components/layout/page-layouts';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { UrlStateProvider } from '@/components/layout/url-state';
import { Heading } from '@/components/ui';
import { ConversationList, MessagesFrame } from '@/features/messaging';
import { configureServerApi } from '@/lib/api/server';

/**
 * The messaging (§10.4): the list of the conversations, read by the server for the first render
 * (the inbox) and kept while the conversations change, beside the open conversation on a
 * computer; on a phone, the list then the conversation at its own address.
 */
export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('web.messaging');
  configureServerApi();
  const inbox = await messagingControllerList(
    { box: 'inbox', limit: 20 },
    { cache: 'no-store' },
  ).catch(() => null);
  return (
    <Main>
      <ScopedMessages scope="messaging">
        <UrlStateProvider>
          <MessagesFrame
            title={
              <Heading level={1} size="page">
                {t('title')}
              </Heading>
            }
            list={<ConversationList initialInbox={inbox} />}
          >
            {children}
          </MessagesFrame>
        </UrlStateProvider>
      </ScopedMessages>
    </Main>
  );
}
