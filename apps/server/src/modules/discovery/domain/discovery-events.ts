import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/** « Pas intéressé » : the member dismissed a suggestion; it is never suggested again. */
export class SuggestionDismissed extends DomainEvent<{
  candidateKind: string;
  candidateId: string;
}> {
  static readonly TYPE = 'discovery.suggestion.dismissed.v1';
  readonly type = SuggestionDismissed.TYPE;
  readonly aggregateType = 'member';
  constructor(props: DomainEventProps<SuggestionDismissed['payload']>) {
    super(props);
  }
}

/**
 * The drift check found the projection different from the sources (ADR 0065): counts per
 * kind of entities missing, stale or left over; the entities found are reindexed.
 */
export class IndexDriftDetected extends DomainEvent<{
  missing: number;
  stale: number;
  orphaned: number;
  kinds: string[];
}> {
  static readonly TYPE = 'discovery.index.drift-detected.v1';
  readonly type = IndexDriftDetected.TYPE;
  readonly aggregateType = 'search_index';
  constructor(props: DomainEventProps<IndexDriftDetected['payload']>) {
    super(props);
  }
}
