import type { ProjectTeamRole } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import type { TeamMemberRecord } from './project';

const lastOwner = () =>
  new DomainError('PROJECTS_LAST_OWNER', 'A project cannot be left without an owner');

/** Removing or leaving: an active owner may go only if another active owner stays. */
export function assertCanGo(member: TeamMemberRecord, activeOwners: number): void {
  if (member.status === 'active' && member.role === 'owner' && activeOwners <= 1) {
    throw lastOwner();
  }
}

export function assertRoleChange(
  member: TeamMemberRecord,
  role: ProjectTeamRole,
  activeOwners: number,
): void {
  if (member.status === 'active' && member.role === 'owner' && role !== 'owner') {
    if (activeOwners <= 1) throw lastOwner();
  }
}

/**
 * Members shown on the project page: active, and having consented to the public display of
 * their name, photo and headline (ADR 0040). The team sees every active member in preview.
 */
export function shownOnPage(member: TeamMemberRecord, forTeam: boolean): boolean {
  return member.status === 'active' && (forTeam || member.publicDisplayConsentAt !== null);
}
