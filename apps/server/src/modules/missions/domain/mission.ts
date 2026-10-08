import {
  type ContributorHat,
  MISSION_MAX_HOURS,
  type MissionDirection,
  type MissionEngagementStatus,
  type MissionFormat,
  type MissionMode,
  type MissionModerationStatus,
  type MissionStatus,
  type MissionVisibility,
  type TimeEntryKind,
} from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export interface MissionRecord {
  id: string;
  direction: MissionDirection;
  authorId: string;
  projectId: string | null;
  title: string;
  description: string;
  kind: TimeEntryKind;
  domain: string;
  sectorCodes: string[];
  format: MissionFormat;
  estimatedHours: number;
  mode: MissionMode;
  countryCodes: string[];
  languages: string[];
  capacity: number;
  skills: string[];
  desiredBy: string | null;
  visibility: MissionVisibility;
  status: MissionStatus;
  moderationStatus: MissionModerationStatus;
  activeEngagements: number;
  publishedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EngagementRecord {
  id: string;
  missionId: string;
  /** The member who gives their time. */
  expertId: string;
  /** The member helped, or who asked for their project. */
  beneficiaryId: string;
  projectId: string | null;
  status: MissionEngagementStatus;
  message: string;
  answerMessage: string | null;
  timeEntryId: string | null;
  requestedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  updatedAt: Date;
}

/**
 * Engagement lifecycle: asked, answered by the author of the mission (accepted or declined),
 * then, once in progress, completed by the expert or canceled by either side. Asked, it may also
 * be withdrawn (canceled) by the member who asked.
 */
const TRANSITIONS: Readonly<Record<MissionEngagementStatus, readonly MissionEngagementStatus[]>> = {
  requested: ['accepted', 'declined', 'canceled'],
  accepted: ['completed', 'canceled'],
  declined: [],
  completed: [],
  canceled: [],
};

export function canTransition(from: MissionEngagementStatus, to: MissionEngagementStatus) {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: MissionEngagementStatus, to: MissionEngagementStatus) {
  if (!canTransition(from, to)) {
    throw new DomainError(
      'MISSIONS_INVALID_TRANSITION',
      `An engagement cannot go from ${from} to ${to}`,
    );
  }
}

/** Hat a member needs to give time of this kind: mentor for mentoring, expert for expertise. */
export function hatFor(kind: TimeEntryKind): ContributorHat {
  return kind === 'mentoring' ? 'mentor' : 'expert';
}

export function assertExpertHat(kind: TimeEntryKind, hats: readonly string[]): void {
  if (!hats.includes(hatFor(kind))) {
    throw new DomainError('MISSIONS_HAT_REQUIRED', `The ${hatFor(kind)} hat is required`);
  }
}

/** A packaged mission is short (provisional bounds, docs/open-questions.md). */
export function assertHours(format: MissionFormat, hours: number): void {
  if (hours > MISSION_MAX_HOURS[format]) {
    throw new DomainError(
      'MISSIONS_HOURS_EXCEEDED',
      `A ${format} lasts ${MISSION_MAX_HOURS[format]} hours at most`,
    );
  }
}

/**
 * Fields that fit the direction and the mode: skills and deadline describe a request, a
 * capacity above one an offer; on site needs at least one country.
 */
export function assertFields(mission: {
  direction: MissionDirection;
  mode: MissionMode;
  countryCodes: readonly string[];
  skills: readonly string[];
  desiredBy: string | null;
  capacity: number;
}): void {
  const invalid = (reason: string) => new DomainError('MISSIONS_FIELDS_INVALID', reason);
  if (mission.mode === 'on_site' && mission.countryCodes.length === 0) {
    throw invalid('An on-site mission needs a country');
  }
  if (mission.direction === 'offer' && (mission.skills.length > 0 || mission.desiredBy)) {
    throw invalid('Skills and deadline describe a request');
  }
  if (mission.direction === 'request' && mission.capacity !== 1) {
    throw invalid('A request is answered by one engagement at a time');
  }
}

/**
 * Missions are volunteer skills-based patronage (ADR 0071): no pay, no contract, no job offer.
 * The structured fields hold no amount; the free texts are checked for the vocabulary of a job
 * posting (French and English, provisional list).
 */
const JOB_POSTING_TERMS: readonly RegExp[] = [
  /\bcdi\b/i,
  /\bcdd\b/i,
  /\bsalaire\b/i,
  /\bsalari(?:é|e)s?\b/i,
  /\br(?:é|e)mun(?:é|e)r(?:ation|é|ee|e)s?\b/i,
  /\bpay(?:é|e)e?s?\b.*\b(?:heure|jour|mois)\b/i,
  /\btjm\b/i,
  /\boffres? d'emploi\b/i,
  /\brecrut(?:e|ement|ons)\b/i,
  /\bpostes? (?:à pourvoir|en cdi|salari(?:é|e))\b/i,
  /\btemps plein\b/i,
  /\bsalary\b/i,
  /\bwages?\b/i,
  /\bhourly rate\b/i,
  /\bday rate\b/i,
  /\bfull[- ]time\b/i,
  /\bpermanent (?:position|contract|role)\b/i,
  /\bjob (?:offer|opening|posting)\b/i,
  /\bwe(?:'re| are) hiring\b/i,
  /\bpaid (?:position|role|internship)\b/i,
];

export function jobPostingTerm(...texts: readonly (string | null | undefined)[]): string | null {
  const text = texts.filter((part) => part).join('\n');
  const found = JOB_POSTING_TERMS.find((pattern) => pattern.test(text));
  return found ? (text.match(found)?.[0] ?? null) : null;
}

export function assertNotAJobPosting(...texts: readonly (string | null | undefined)[]): void {
  const term = jobPostingTerm(...texts);
  if (term) {
    throw new DomainError(
      'MISSIONS_JOB_POSTING_REFUSED',
      `Missions are volunteer, not jobs: « ${term} »`,
    );
  }
}

/** Same rule as publications (ADR 0031): `public` needs the public page of the author. */
export function effectiveVisibility(
  visibility: MissionVisibility,
  authorIsPublic: boolean,
): MissionVisibility {
  return visibility === 'public' && authorIsPublic ? 'public' : 'members';
}

/** Who answers an engagement: the author of the mission; who asked: the other side. */
export function sidesOf(mission: MissionRecord, engagement: EngagementRecord) {
  const responderId = mission.authorId;
  const requesterId =
    mission.direction === 'offer' ? engagement.beneficiaryId : engagement.expertId;
  return { responderId, requesterId };
}
