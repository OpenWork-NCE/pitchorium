import {
  memberNetworkControllerPublicConnections,
  memberNetworkControllerPublicFollowers,
  memberNetworkControllerPublicFollowing,
} from '@pitchorium/api-client';
import type { Connection, Follow, Follower } from '@pitchorium/contracts';
import type { NetworkRowItem } from '../components/network-row';

export const VISITOR_LIST_TABS = ['connections', 'followers', 'following'] as const;
export type VisitorListTab = (typeof VISITOR_LIST_TABS)[number];
export const VISITOR_FOLLOW_TYPES = ['all', 'member', 'organization'] as const;
export type VisitorFollowType = (typeof VISITOR_FOLLOW_TYPES)[number];

/** A row and the date it shows, for each kind of list. */
export interface VisitorListEntry {
  item: NetworkRowItem;
  since: string;
}

export interface VisitorListPage {
  entries: VisitorListEntry[];
  nextCursor: string | null;
}

const fromMember = (member: Connection['member']): NetworkRowItem => ({
  key: `member:${member.handle}`,
  type: 'member',
  name: member.displayName,
  slug: member.handle,
  subtitle: member.headline,
  imageUrl: member.avatarUrl,
});

/**
 * A page of a list of a member read without a session, from the server for the first page and
 * from the browser for the next ones (public routes of the api, as the member's privacy allows).
 */
export async function visitorListPage(
  handle: string,
  tab: VisitorListTab,
  type: VisitorFollowType,
  cursor: string | undefined,
): Promise<VisitorListPage> {
  const params = { limit: 20, ...(cursor ? { cursor } : {}) };
  if (tab === 'connections') {
    const page = await memberNetworkControllerPublicConnections(handle, params);
    return {
      entries: page.items.map((row: Connection) => ({
        item: fromMember(row.member),
        since: row.connectedAt,
      })),
      nextCursor: page.nextCursor,
    };
  }
  if (tab === 'followers') {
    const page = await memberNetworkControllerPublicFollowers(handle, params);
    return {
      entries: page.items.map((row: Follower) => ({
        item: fromMember(row.member),
        since: row.followedAt,
      })),
      nextCursor: page.nextCursor,
    };
  }
  const page = await memberNetworkControllerPublicFollowing(handle, {
    ...params,
    ...(type === 'all' ? {} : { type }),
  });
  return {
    entries: page.items.map((row: Follow) => ({
      item: {
        key: `${row.target.type}:${row.target.key}`,
        type: row.target.type,
        name: row.target.displayName,
        slug: row.target.slug,
        // The subtitle of an organization is a code, not a text for a visitor.
        subtitle: row.target.type === 'member' ? row.target.subtitle : null,
        imageUrl: row.target.imageUrl,
      },
      since: row.followedAt,
    })),
    nextCursor: page.nextCursor,
  };
}
