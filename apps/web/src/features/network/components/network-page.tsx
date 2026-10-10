'use client';

import {
  type CountersDtoOutput,
  connectionsControllerList,
  connectionsControllerWithdraw,
  getNotificationsControllerCountersQueryKey,
  notificationsControllerCounters,
  useDiscoveryControllerList,
} from '@pitchorium/api-client';
import type { ConnectionRequest } from '@pitchorium/contracts';
import { useQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { type ComponentProps } from 'react';
import { UrlStateProvider } from '@/components/layout/url-state';
import {
  AlertDialog,
  Button,
  Card,
  Heading,
  notify,
  Skeleton,
  Tabs,
  TabsPanel,
  useAnnounce,
} from '@/components/ui';
import { SuggestionsList } from '@/features/discovery';
import { ConnectionRequestActions } from './connection-request-actions';
import { CursorList, useCursorList } from './cursor-list';
import { MemberLists, MemberRow } from './member-lists';
import { useProblemMessage } from './use-relationship';

const TABS = ['invitations', 'suggestions', 'lists'] as const;

/**
 * The network of the member (§10.2): invitations received (accept, ignore) and sent (withdraw),
 * with their note; the suggestions of the matching (« Personnes pertinentes pour vous »,
 * « Entrepreneurs complémentaires »), each with its reason and « Pas intéressé »; then their
 * connections, followers and follows, organizations included. The tab lives in the address.
 */
function NetworkPageContent({
  handle,
  name,
  counters,
}: {
  handle: string;
  name: string;
  /** Counters read by the server: the requests still to answer, then kept live by the realtime. */
  counters: CountersDtoOutput | null;
}) {
  const t = useTranslations('web.network.page');
  // The key the realtime channel writes (lib/realtime): the count follows a request at once.
  const live = useQuery({
    queryKey: getNotificationsControllerCountersQueryKey(),
    queryFn: ({ signal }) => notificationsControllerCounters({ signal }),
    initialData: counters ?? undefined,
  });
  const pending = live.data?.invitations.connections ?? 0;
  const [tab, setTab] = useQueryState(
    'view',
    parseAsStringLiteral(TABS).withDefault('invitations'),
  );
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => void setTab(next)}
      label={t('sections')}
      tabs={[
        {
          value: 'invitations',
          label: t('tabs.invitations'),
          ...(pending > 0 ? { count: pending } : {}),
        },
        { value: 'suggestions', label: t('tabs.suggestions') },
        { value: 'lists', label: t('tabs.lists') },
      ]}
    >
      <TabsPanel value="invitations">
        <Invitations />
      </TabsPanel>
      <TabsPanel value="suggestions">
        <Suggestions />
      </TabsPanel>
      <TabsPanel value="lists">
        <MemberLists handle={handle} name={name} self signedIn />
      </TabsPanel>
    </Tabs>
  );
}

function Note({ request }: { request: ConnectionRequest }) {
  const t = useTranslations('web.network.page');
  const format = useFormatter();
  return (
    <>
      {request.note ? (
        <blockquote className="mt-1 border-l-2 border-border pl-3 text-sm whitespace-pre-line">
          {request.note}
        </blockquote>
      ) : null}
      <p className="text-xs text-muted">
        {t('sentOn', {
          date: format.dateTime(new Date(request.createdAt), { dateStyle: 'medium' }),
        })}
      </p>
    </>
  );
}

function Invitations() {
  const t = useTranslations('web.network.page');
  const announce = useAnnounce();
  const message = useProblemMessage();
  const received = useCursorList<ConnectionRequest>(['requests', 'received'], (params) =>
    connectionsControllerList({ ...params, direction: 'received' }),
  );
  const sent = useCursorList<ConnectionRequest>(['requests', 'sent'], (params) =>
    connectionsControllerList({ ...params, direction: 'sent' }),
  );
  return (
    <div className="grid gap-8">
      <section className="grid gap-3" aria-labelledby="received">
        <Heading level={2} size="card" id="received">
          {t('received')}
        </Heading>
        <CursorList
          list={received}
          label={t('received')}
          empty={{ title: t('noReceived.title'), description: t('noReceived.description') }}
          renderItem={(request) => (
            <MemberRow
              key={request.id}
              member={request.member}
              signedIn
              meta={<Note request={request} />}
              actions={
                <ConnectionRequestActions
                  requestId={request.id}
                  name={request.member.displayName}
                />
              }
            />
          )}
        />
      </section>
      <section className="grid gap-3" aria-labelledby="sent">
        <Heading level={2} size="card" id="sent">
          {t('sent')}
        </Heading>
        <CursorList
          list={sent}
          label={t('sent')}
          empty={{ title: t('noSent.title'), description: t('noSent.description') }}
          renderItem={(request) => (
            <MemberRow
              key={request.id}
              member={request.member}
              signedIn
              meta={<Note request={request} />}
              actions={
                <AlertDialog
                  trigger={
                    <Button size="sm" variant="outline">
                      {t('withdraw')}
                    </Button>
                  }
                  title={t('withdrawTitle', { name: request.member.displayName })}
                  description={t('withdrawDescription')}
                  confirmLabel={t('withdraw')}
                  tone="primary"
                  onConfirm={async () => {
                    try {
                      await sent.remove(
                        (item) => item.id === request.id,
                        () => connectionsControllerWithdraw(request.id),
                      );
                      announce(t('withdrawn'));
                    } catch (error) {
                      notify.error(message(error));
                    }
                  }}
                />
              }
            />
          )}
        />
      </section>
    </div>
  );
}

/** The two lists of the matching for the member, each said with its reasons (ADR 0067). */
function Suggestions() {
  const t = useTranslations('web.network.page');
  const people = useDiscoveryControllerList(
    { list: 'people', limit: 10 },
    { query: { staleTime: 60_000 } },
  );
  const complementary = useDiscoveryControllerList(
    { list: 'complementary_entrepreneurs', limit: 10 },
    { query: { staleTime: 60_000 } },
  );
  const lists = [
    { key: 'people', title: t('people'), query: people },
    { key: 'complementary', title: t('complementary'), query: complementary },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {lists.map(({ key, title, query }) =>
        query.isPending ? (
          <Card key={key} padding="sm" className="grid gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </Card>
        ) : query.data && query.data.items.length > 0 ? (
          <SuggestionsList key={key} title={title} suggestions={query.data.items} />
        ) : (
          <Card key={key} padding="sm" className="grid gap-2">
            <Heading level={2} size="label">
              {title}
            </Heading>
            <p className="text-sm text-muted">{t('noSuggestions')}</p>
          </Card>
        ),
      )}
    </div>
  );
}

/** NetworkPage, with the URL state it keeps its tab in (nuqs, mounted by its users only, ADR 0094). */
export function NetworkPage(props: ComponentProps<typeof NetworkPageContent>) {
  return (
    <UrlStateProvider>
      <NetworkPageContent {...props} />
    </UrlStateProvider>
  );
}
