import type { ImpactAssessmentSource, ImpactLevel, ImpactSubjectType } from '@pitchorium/contracts';
import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

export class MethodologyPublished extends DomainEvent<{
  version: number;
  demo: boolean;
  /** Version archived by this publication, null when none was published. */
  replacedVersion: number | null;
}> {
  static readonly TYPE = 'impact.methodology.published.v1';
  readonly type = MethodologyPublished.TYPE;
  readonly aggregateType = 'impact_methodology';
  constructor(props: DomainEventProps<MethodologyPublished['payload']>) {
    super(props);
  }
}

type AssessmentPayload = {
  subjectType: ImpactSubjectType;
  subjectId: string;
  methodologyId: string;
  methodologyVersion: number;
  score: number;
  level: ImpactLevel;
  source: ImpactAssessmentSource;
  submittedBy: string;
};

/** First assessment of a subject. */
export class AssessmentSubmitted extends DomainEvent<AssessmentPayload> {
  static readonly TYPE = 'impact.assessment.submitted.v1';
  readonly type = AssessmentSubmitted.TYPE;
  readonly aggregateType = 'impact_assessment';
  constructor(props: DomainEventProps<AssessmentPayload>) {
    super(props);
  }
}

/** A new assessment of a subject already assessed; the previous ones stay in the history. */
export class AssessmentUpdated extends DomainEvent<AssessmentPayload> {
  static readonly TYPE = 'impact.assessment.updated.v1';
  readonly type = AssessmentUpdated.TYPE;
  readonly aggregateType = 'impact_assessment';
  constructor(props: DomainEventProps<AssessmentPayload>) {
    super(props);
  }
}
