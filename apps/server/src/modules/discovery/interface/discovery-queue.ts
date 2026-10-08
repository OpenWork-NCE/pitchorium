/** BullMQ queue of the discovery module (worker): suggestions and the drift check. */
export const DISCOVERY_QUEUE = 'discovery.matching';

export const DISCOVERY_JOBS = {
  /** Every list of a member, from scratch. */
  member: 'member',
  /** Potential contributors of a project, from scratch. */
  project: 'project',
  /** A candidate changed: its row in the lists that it concerns. */
  candidate: 'candidate',
  checkDrift: 'check-drift',
} as const;

export interface MatchingJob {
  kind: 'person' | 'organization' | 'project' | 'event' | 'mission';
  id: string;
}
