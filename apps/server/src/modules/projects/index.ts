/** Public facade of the projects module: the only file other modules may import. */
export { ProjectsFacade } from './application/projects.facade';
export type { FundingSnapshot } from './application/funding.service';
export { PROJECT_FOLLOW_TARGET } from './application/project-reads.service';
export type { ReservationStatus } from './domain/rewards';
export {
  InterestExpressed,
  ProjectClosed,
  ProjectCreated,
  ProjectDeleted,
  ProjectEndingSoon,
  ProjectFunded,
  ProjectPublished,
  ProjectUpdated,
  RewardCreated,
  RewardSoldOut,
  RewardUpdated,
  TeamMemberAdded,
  TeamMemberRemoved,
  TierUnlocked,
  UpdatePublished,
} from './domain/project-events';
export { ProjectsModule } from './projects.module';
