/** Public facade of the impact module: the only file other modules may import. */
export { ImpactFacade } from './application/impact.facade';
export type {
  Subject as ImpactSubject,
  Submission as ImpactSubmission,
} from './application/assessments.service';
export {
  AssessmentSubmitted,
  AssessmentUpdated,
  MethodologyPublished,
} from './domain/impact-events';
export { ImpactModule } from './impact.module';
