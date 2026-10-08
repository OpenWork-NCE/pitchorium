/** Public facade of the profiles module: the only file other modules may import. */
export {
  ContributorFacetUpdated,
  EntrepreneurFacetUpdated,
  HandleChanged,
  IntentionSet,
  ProfileCreated,
  ProfileUpdated,
  VisibilityChanged,
} from './domain/profile-events';
export { type MemberCard, ProfilesFacade, type ProfileSource } from './application/profiles.facade';
export type {
  OrganizationDirectory,
  OrganizationSummary,
  ProfileAccessFilter,
  ProfileView,
  ProfileViewListener,
} from './application/ports';
export { ProfilesModule } from './profiles.module';
