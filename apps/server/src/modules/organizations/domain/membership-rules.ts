import type { OrganizationRole } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

/**
 * Rules of the internal roles. An owner manages everyone; an admin manages admins and members
 * but never an owner, and cannot make anyone owner. An organization always keeps an owner.
 */

const forbidden = (message: string) =>
  new DomainError('ORGANIZATIONS_ROLE_CHANGE_FORBIDDEN', message);
const lastOwner = () =>
  new DomainError('ORGANIZATIONS_LAST_OWNER', 'An organization keeps at least one owner');

export function assertRoleChange(
  actorRole: OrganizationRole,
  targetRole: OrganizationRole,
  nextRole: OrganizationRole,
  ownerCount: number,
): void {
  if (actorRole === 'member') throw forbidden('Members cannot change roles');
  if (actorRole === 'admin' && (targetRole === 'owner' || nextRole === 'owner')) {
    throw forbidden('Only an owner can change the role of an owner or make an owner');
  }
  if (targetRole === 'owner' && nextRole !== 'owner' && ownerCount <= 1) throw lastOwner();
}

export function assertRemoval(
  actorRole: OrganizationRole,
  targetRole: OrganizationRole,
  ownerCount: number,
): void {
  if (actorRole === 'member') throw forbidden('Members cannot remove members');
  if (actorRole === 'admin' && targetRole === 'owner') {
    throw forbidden('Only an owner can remove an owner');
  }
  if (targetRole === 'owner' && ownerCount <= 1) throw lastOwner();
}

export function assertCanLeave(role: OrganizationRole, ownerCount: number): void {
  if (role === 'owner' && ownerCount <= 1) throw lastOwner();
}

/**
 * Ownership goes from an owner to another member; the previous owner stays as an admin.
 * Returns the new roles.
 */
export function transferOwnership(
  actorRole: OrganizationRole,
  targetRole: OrganizationRole | null,
  sameMember: boolean,
): { previousOwner: OrganizationRole; newOwner: OrganizationRole } {
  if (actorRole !== 'owner') throw forbidden('Only an owner can transfer ownership');
  if (targetRole === null) {
    throw new DomainError('ORGANIZATIONS_MEMBER_NOT_FOUND', 'The new owner must be a member');
  }
  if (sameMember) throw forbidden('Ownership must go to another member');
  return { previousOwner: 'admin', newOwner: 'owner' };
}
