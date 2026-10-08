/** Public facade of the trust module: the only file other modules may import. */
export { type DecisionNotice, TrustFacade } from './application/trust.facade';
export {
  AppealResolved,
  DecisionAppealed,
  DecisionTaken,
  ReportCreated,
  ReportResolved,
  SuspensionEnded,
  SuspensionStarted,
} from './domain/trust-events';
export { TrustModule } from './trust.module';
