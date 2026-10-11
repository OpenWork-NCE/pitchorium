/**
 * The refusals of the api that concern the volunteer nature of a mission (ADR 0071), with the key
 * of their message in `web.missions.refusals`: a vocabulary of job offer, too many hours for the
 * format, a missing hat. Each explains the rule instead of only refusing.
 */
export const MISSION_REFUSALS = {
  MISSIONS_JOB_POSTING_REFUSED: 'jobPosting',
  MISSIONS_HOURS_EXCEEDED: 'hours',
  MISSIONS_HAT_REQUIRED: 'hat',
  MISSIONS_FIELDS_INVALID: 'fields',
  MISSIONS_BENEFICIARY_REQUIRED: 'beneficiary',
} as const;

export type MissionRefusal = (typeof MISSION_REFUSALS)[keyof typeof MISSION_REFUSALS];

/** The refusal of a code, or null for any other problem (said by `errors.<code>`). */
export function missionRefusal(code: string): MissionRefusal | null {
  return (MISSION_REFUSALS as Record<string, MissionRefusal>)[code] ?? null;
}

/** Field of the form a refusal concerns, to place its message under it. */
export const REFUSAL_FIELDS: Readonly<Record<string, string>> = {
  MISSIONS_JOB_POSTING_REFUSED: 'description',
  MISSIONS_HOURS_EXCEEDED: 'estimatedHours',
};
