import type { OrganizationRole } from '@pitchorium/contracts';

/**
 * Indicative reading of the roles of an organisation (README of the module): what the page shows
 * or hides; the api decides every action and refuses the rest with its stable code.
 */

/** Owners and admins edit the page, invite and manage the members. */
export function canManage(role: OrganizationRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * The roles the reader may give to a member: an owner gives any role; an admin manages admins and
 * members only, and never names an owner. None for a member, or towards an owner for an admin.
 */
export function assignableRoles(
  viewer: OrganizationRole | null,
  target: OrganizationRole,
): readonly OrganizationRole[] {
  if (viewer === 'owner') return ['owner', 'admin', 'member'];
  if (viewer === 'admin' && target !== 'owner') return ['admin', 'member'];
  return [];
}

/**
 * True when this member is the last owner: their departure, removal or demotion would leave the
 * organisation without one (ORGANIZATIONS_LAST_OWNER).
 */
export function isLastOwner(
  members: readonly { handle: string; role: OrganizationRole }[],
  handle: string,
): boolean {
  const owners = members.filter((member) => member.role === 'owner');
  return owners.length === 1 && owners[0]?.handle === handle;
}
