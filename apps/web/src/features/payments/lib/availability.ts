import type { ProjectPaymentAvailability } from '@pitchorium/contracts';

/**
 * What the interface offers for each availability code of the api (ADR 0135, ADR 0138): the code
 * is read, never deduced. `pay` opens the contribution journey; `alternatives` keeps what needs no
 * online payment (love money commitment, interest, off-platform contribution); `final` ends the
 * campaign without any payment action.
 */
export interface AvailabilityPresentation {
  /** Online payment is offered. */
  pay: boolean;
  /** The ways to support without paying online stay offered. */
  alternatives: boolean;
  /** Tone of the notice: an end, a wait, or nothing to say. */
  tone: 'none' | 'info' | 'neutral';
}

const PRESENTATIONS: Record<ProjectPaymentAvailability, AvailabilityPresentation> = {
  open: { pay: true, alternatives: true, tone: 'none' },
  holder_not_verified: { pay: false, alternatives: true, tone: 'info' },
  holder_without_covered_payout_account: { pay: false, alternatives: true, tone: 'info' },
  // The moderation stopped the contributions: neither closed nor open, and nothing to pay.
  funding_frozen: { pay: false, alternatives: false, tone: 'neutral' },
  campaign_closed: { pay: false, alternatives: false, tone: 'neutral' },
};

export function availabilityPresentation(
  availability: ProjectPaymentAvailability,
): AvailabilityPresentation {
  return PRESENTATIONS[availability];
}
