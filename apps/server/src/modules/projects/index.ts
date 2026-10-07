/** Public facade of the projects module: the only file other modules may import. */
export {
  type FundableProject,
  type FundableReward,
  ProjectsFacade,
} from './application/projects.facade';
export type { FundingReversal, FundingSnapshot } from './application/funding.service';
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
  TeamInvitationDeclined,
  TeamMemberAdded,
  TeamMemberInvited,
  TeamMemberRemoved,
  TierUnlocked,
  UpdatePublished,
} from './domain/project-events';
export { ProjectsModule } from './projects.module';
