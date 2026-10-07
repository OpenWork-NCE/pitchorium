/** Public facade of the organizations module: the only file other modules may import. */
export { OrganizationsFacade } from './application/organizations.facade';
export type { OrganizationProjectsProvider } from './application/ports';
export {
  MemberInvited,
  MemberJoined,
  MemberLeft,
  MemberRoleChanged,
  OrganizationCreated,
  OrganizationDeleted,
  OrganizationUpdated,
  OwnershipTransferred,
  VerificationApproved,
  VerificationRejected,
  VerificationRequested,
  VerificationRevoked,
} from './domain/organization-events';
export { OrganizationsModule } from './organizations.module';
