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
export { ProfilesModule } from './profiles.module';
