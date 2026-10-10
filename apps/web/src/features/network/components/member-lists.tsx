'use client';

import {
  ApiProblemError,
  connectionsControllerRemove,
  followsControllerUnfollow,
  memberNetworkControllerConnections,
  memberNetworkControllerFollowers,
  memberNetworkControllerFollowing,
  memberNetworkControllerPublicConnections,
  memberNetworkControllerPublicFollowers,
  memberNetworkControllerPublicFollowing,
} from '@pitchorium/api-client';
import type { Connection, Follow, Follower, MemberCard } from '@pitchorium/contracts';
import { Building2, Lock } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { UrlStateProvider } from '@/components/layout/url-state';
import { type ComponentProps, type ReactNode, useState } from 'react';
import {
  AlertDialog,
  Avatar,
  Button,
  EmptyState,
  Tabs,
  TabsPanel,
  ToggleGroup,
  notify,
  useAnnounce,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { MemberHoverCard } from '@/features/profiles';
import { Link } from '@/i18n/navigation';
import { CursorList, useCursorList } from './cursor-list';
import { useProblemMessage } from './use-relationship';

export const LIST_TABS = ['connections', 'followers', 'following'] as const;

/** A member in a list: photo, name with its preview, title, then what the row adds. */
export function MemberRow({
  member,
  signedIn,
  meta,
  actions,
}: {
  member: MemberCard;
  signedIn: boolean;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-3">
      <Avatar name={member.displayName} src={member.avatarUrl} size="lg" decorative />
      <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
        <MemberHoverCard member={member} signedIn={signedIn} />
        {member.headline ? (
          <p className="line-clamp-2 text-sm text-muted">{member.headline}</p>
        ) : null}
        {meta}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </li>
  );
}

/** A list hidden by the privacy of the member (403 NETWORK_LIST_HIDDEN): said as such. */
function isHidden(error: unknown): boolean {
  return error instanceof ApiProblemError && error.problem.code === 'NETWORK_LIST_HIDDEN';
}

/**
 * Connections, followers and following of a member (§10.2), page by page, as the privacy of the
 * member allows (the api decides: a hidden list says so). On the member's own lists, a
 * connection is removed and a follow stopped after a confirmation, at once in the list.
 */
function MemberListsContent({
  handle,
  name,
  self,
  signedIn,
}: {
  handle: string;
  name: string;
  /** The reader's own lists: their actions. */
  self: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations('web.network.lists');
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(LIST_TABS).withDefault('connections'),
  );
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => void setTab(next)}
      label={t('label', { name })}
      tabs={LIST_TABS.map((value) => ({ value, label: t(`tabs.${value}`) }))}
    >
      <TabsPanel value="connections">
        <Connections handle={handle} self={self} signedIn={signedIn} />
      </TabsPanel>
      <TabsPanel value="followers">
        <Followers handle={handle} signedIn={signedIn} />
      </TabsPanel>
      <TabsPanel value="following">
        <Following handle={handle} self={self} signedIn={signedIn} />
      </TabsPanel>
    </Tabs>
  );
}

function HiddenList() {
  const t = useTranslations('web.network.lists');
  return (
    <EmptyState
      size="inline"
      icon={<Lock />}
      title={t('hidden.title')}
      description={t('hidden.description')}
    />
  );
}

function useSince() {
  const t = useTranslations('web.network.lists');
  const format = useFormatter();
  return (date: string, key: 'connectedSince' | 'followingSince' | 'followerSince') => (
    <p className="text-xs text-muted">
      {t(key, { date: format.dateTime(new Date(date), { dateStyle: 'medium' }) })}
    </p>
  );
}

function Connections({
  handle,
  self,
  signedIn,
}: {
  handle: string;
  self: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations('web.network.lists');
  const announce = useAnnounce();
  const message = useProblemMessage();
  const since = useSince();
  const list = useCursorList<Connection>(['connections', handle, signedIn], (params) =>
    signedIn
      ? memberNetworkControllerConnections(handle, params)
      : memberNetworkControllerPublicConnections(handle, params),
  );
  if (list.query.isError && isHidden(list.query.error)) return <HiddenList />;
  return (
    <CursorList
      list={list}
      label={t('tabs.connections')}
      empty={{ title: t(self ? 'empty.ownConnections' : 'empty.connections') }}
      renderItem={(connection) => (
        <MemberRow
          key={connection.member.handle}
          member={connection.member}
          signedIn={signedIn}
          meta={since(connection.connectedAt, 'connectedSince')}
          actions={
            self ? (
              <AlertDialog
                trigger={
                  <Button size="sm" variant="outline">
                    {t('remove')}
                  </Button>
                }
                title={t('removeTitle', { name: connection.member.displayName })}
                description={t('removeDescription', { name: connection.member.displayName })}
                confirmLabel={t('remove')}
                onConfirm={async () => {
                  try {
                    await list.remove(
                      (item) => item.member.handle === connection.member.handle,
                      () => connectionsControllerRemove(connection.member.handle),
                    );
                    announce(t('removed', { name: connection.member.displayName }));
                  } catch (error) {
                    notify.error(message(error));
                  }
                }}
              />
            ) : undefined
          }
        />
      )}
    />
  );
}

function Followers({ handle, signedIn }: { handle: string; signedIn: boolean }) {
  const t = useTranslations('web.network.lists');
  const since = useSince();
  const list = useCursorList<Follower>(['followers', handle, signedIn], (params) =>
    signedIn
      ? memberNetworkControllerFollowers(handle, params)
      : memberNetworkControllerPublicFollowers(handle, params),
  );
  if (list.query.isError && isHidden(list.query.error)) return <HiddenList />;
  return (
    <CursorList
      list={list}
      label={t('tabs.followers')}
      empty={{ title: t('empty.followers') }}
      renderItem={(follower) => (
        <MemberRow
          key={follower.member.handle}
          member={follower.member}
          signedIn={signedIn}
          meta={since(follower.followedAt, 'followerSince')}
        />
      )}
    />
  );
}

const FOLLOW_TYPES = ['all', 'member', 'organization'] as const;

function Following({
  handle,
  self,
  signedIn,
}: {
  handle: string;
  self: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations('web.network.lists');
  const announce = useAnnounce();
  const message = useProblemMessage();
  const since = useSince();
  const [type, setType] = useState<(typeof FOLLOW_TYPES)[number]>('all');
  const list = useCursorList<Follow>(['following', handle, signedIn, type], (params) => {
    const query = { ...params, ...(type === 'all' ? {} : { type }) };
    return signedIn
      ? memberNetworkControllerFollowing(handle, query)
      : memberNetworkControllerPublicFollowing(handle, query);
  });
  if (list.query.isError && isHidden(list.query.error)) return <HiddenList />;
  return (
    <div className="grid gap-4">
      <ToggleGroup
        type="single"
        label={t('filter')}
        options={FOLLOW_TYPES.map((value) => ({ value, label: t(`types.${value}`) }))}
        value={type}
        onValueChange={setType}
        className="justify-self-start"
      />
      <CursorList
        list={list}
        label={t('tabs.following')}
        empty={{ title: t(self ? 'empty.ownFollowing' : 'empty.following') }}
        renderItem={(follow) => {
          const { target } = follow;
          const unfollow = self ? (
            <AlertDialog
              trigger={
                <Button size="sm" variant="outline">
                  {t('unfollow')}
                </Button>
              }
              title={t('unfollowTitle', { name: target.displayName })}
              description={t('unfollowDescription', { name: target.displayName })}
              confirmLabel={t('unfollow')}
              tone="primary"
              onConfirm={async () => {
                try {
                  await list.remove(
                    (item) => item.target.type === target.type && item.target.key === target.key,
                    () => followsControllerUnfollow(target.type, target.key),
                  );
                  announce(t('unfollowed', { name: target.displayName }));
                } catch (error) {
                  notify.error(message(error));
                }
              }}
            />
          ) : undefined;
          if (target.type === 'member') {
            return (
              <MemberRow
                key={`${target.type}:${target.key}`}
                member={{
                  handle: target.key,
                  displayName: target.displayName,
                  headline: target.subtitle,
                  avatarUrl: target.imageUrl,
                }}
                signedIn={signedIn}
                meta={since(follow.followedAt, 'followingSince')}
                actions={unfollow}
              />
            );
          }
          return (
            <li
              key={`${target.type}:${target.key}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-3"
            >
              <Avatar
                name={target.displayName}
                src={target.imageUrl}
                size="lg"
                shape="square"
                decorative
              />
              <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Building2 aria-hidden className="size-4 text-muted" />
                  {target.slug ? (
                    <Link
                      href={
                        target.type === 'organization'
                          ? routes.organization(target.slug)
                          : routes.project(target.slug)
                      }
                      className="link-underline-hover"
                    >
                      {target.displayName}
                    </Link>
                  ) : (
                    target.displayName
                  )}
                </span>
                {since(follow.followedAt, 'followingSince')}
              </div>
              {unfollow}
            </li>
          );
        }}
      />
    </div>
  );
}

/** MemberLists, with the URL state it keeps its tab in (nuqs, mounted by its users only, ADR 0094). */
export function MemberLists(props: ComponentProps<typeof MemberListsContent>) {
  return (
    <UrlStateProvider>
      <MemberListsContent {...props} />
    </UrlStateProvider>
  );
}
