import type { MissionEngagementStatus } from '@pitchorium/contracts';

export type EngagementAction = 'accept' | 'decline' | 'complete' | 'cancel' | 'withdraw';

/**
 * The actions of an engagement for its reader, from what the api gives (status and parties): the
 * author of the mission answers a request; the expert completes the mission in progress; either
 * party cancels it; who asked withdraws a request still unanswered. The api decides again at each
 * call (ADR 0071).
 */
export function engagementActions(engagement: {
  status: MissionEngagementStatus;
  /** The reader is the author of the mission (they answer). */
  responder: boolean;
  expert: boolean;
  beneficiary: boolean;
}): EngagementAction[] {
  const party = engagement.expert || engagement.beneficiary;
  switch (engagement.status) {
    case 'requested':
      return engagement.responder ? ['accept', 'decline'] : party ? ['withdraw'] : [];
    case 'accepted':
      return [
        ...(engagement.expert ? (['complete'] as const) : []),
        ...(party ? (['cancel'] as const) : []),
      ];
    case 'declined':
    case 'completed':
    case 'canceled':
      return [];
  }
}

/** What the reader does on a mission they did not write: apply to a request, solicit an offer. */
export function engageVerb(direction: 'offer' | 'request'): 'apply' | 'solicit' {
  return direction === 'request' ? 'apply' : 'solicit';
}
