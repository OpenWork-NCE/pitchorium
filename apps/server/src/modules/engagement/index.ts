/** Public facade of the engagement module: the only file other modules may import. */
export { type DeclaredTime, EngagementFacade } from './application/engagement.facade';
export type { TimeBeneficiary } from './application/engagement.service';
export {
  TimeEntryConfirmed,
  TimeEntryDeclared,
  TimeEntryDisputed,
} from './domain/engagement-events';
export { EngagementModule } from './engagement.module';
