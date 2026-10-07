import {
  type FundingInstrument,
  type ImpactLevel,
  PROJECT_SLUG_PATTERN,
  type ProjectModerationStatus,
  type ProjectStatus,
  type ProjectTeamRole,
  type VideoProvider,
} from '@pitchorium/contracts';
import { DomainError, slugify } from '../../../platform/kernel';

/** Amounts of a project are labelled in euros (section 11.1, ADR 0037). */
export const PROJECT_CURRENCY = 'EUR';

export interface VideoRef {
  provider: VideoProvider;
  videoId: string;
  /** Hash of a private Vimeo link, null otherwise. */
  hash: string | null;
}

export interface ProjectRecord {
  id: string;
  slug: string;
  ownerId: string;
  organizationId: string | null;
  title: string;
  summary: string | null;
  description: string | null;
  sectorCode: string | null;
  impactArea: string | null;
  countryCodes: string[];
  video: VideoRef | null;
  instruments: FundingInstrument[];
  opensCapital: boolean;
  currency: string;
  goalMinor: bigint | null;
  durationDays: number | null;
  galleryMediaIds: string[];
  documentMediaIds: string[];
  status: ProjectStatus;
  collectedMinor: bigint;
  contributionCount: number;
  firstContributionAt: Date | null;
  publicDisplayConsentAt: Date | null;
  publicDisplayConsentBy: string | null;
  impactScore: number | null;
  impactLevel: ImpactLevel | null;
  impactMethodologyVersion: number | null;
  moderationStatus: ProjectModerationStatus;
  featuredAt: Date | null;
  featuredBy: string | null;
  publishedAt: Date | null;
  endsAt: Date | null;
  fundedAt: Date | null;
  closedAt: Date | null;
  endingSoonAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TeamMemberRecord {
  projectId: string;
  userId: string;
  role: ProjectTeamRole;
  function: string | null;
  status: 'invited' | 'active';
  invitedBy: string | null;
  invitedAt: Date;
  joinedAt: Date | null;
  publicDisplayConsentAt: Date | null;
}

const DAY_MS = 86_400_000;

/**
 * Lifecycle (section 11.2): publication opens the funding, reaching the goal makes the project
 * funded while it stays open to contributions, and the end date closes it. A reversed
 * contribution may bring a funded project back to funding before its end.
 */
const TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  draft: ['funding'],
  funding: ['funded', 'closed'],
  funded: ['funding', 'closed'],
  closed: [],
};

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ProjectStatus, to: ProjectStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError(
      'PROJECTS_INVALID_TRANSITION',
      `A project cannot go from ${from} to ${to}`,
    );
  }
}

export function isPublished(project: ProjectRecord): boolean {
  return project.status !== 'draft';
}

/** Open to contributions and expressions of interest: published and not closed. */
export function isOpen(project: ProjectRecord): boolean {
  return project.status === 'funding' || project.status === 'funded';
}

export function assertDraft(project: ProjectRecord): void {
  if (project.status !== 'draft') {
    throw new DomainError('PROJECTS_NOT_DRAFT', 'Only a draft project allows this action');
  }
}

export function assertCurrency(currency: string): void {
  if (currency !== PROJECT_CURRENCY) {
    throw new DomainError(
      'PROJECTS_CURRENCY_NOT_SUPPORTED',
      `Project amounts are in ${PROJECT_CURRENCY}, not ${currency}`,
    );
  }
}

/**
 * Goal, tier thresholds and reward minimums are locked once a paid contribution was applied
 * (ADR 0039): contributors gave under these terms. Texts stay editable.
 */
export function assertAmountsEditable(project: ProjectRecord): void {
  if (project.firstContributionAt !== null) {
    throw new DomainError(
      'PROJECTS_FUNDING_LOCKED',
      'Amounts are locked since the first paid contribution',
    );
  }
}

/** Fields still missing for the publication, by name of the request field. */
export function publicationBlockers(project: ProjectRecord, tierCount: number): string[] {
  const missing: string[] = [];
  if (!project.summary) missing.push('summary');
  if (!project.description) missing.push('description');
  if (!project.sectorCode) missing.push('sectorCode');
  if (!project.impactArea) missing.push('impactArea');
  if (project.countryCodes.length === 0) missing.push('countryCodes');
  if (project.instruments.length === 0) missing.push('instruments');
  if (project.goalMinor === null) missing.push('goal');
  if (project.durationDays === null) missing.push('durationDays');
  if (tierCount === 0) missing.push('tiers');
  return missing;
}

/** End of the campaign, fixed at publication: there is no extension (open question). */
export function endsAtFor(publishedAt: Date, durationDays: number): Date {
  return new Date(publishedAt.getTime() + durationDays * DAY_MS);
}

/** Whole days left, rounded up; 0 on the last day and after the end. */
export function daysLeft(endsAt: Date | null, now: Date): number | null {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS));
}

/** Collected over goal in whole percent, rounded down; may exceed 100. */
export function progressPercent(collectedMinor: bigint, goalMinor: bigint | null): number {
  if (!goalMinor || goalMinor <= 0n) return 0;
  return Number((collectedMinor * 100n) / goalMinor);
}

export const PROJECT_SLUG_MIN_LENGTH = 3;
export const PROJECT_SLUG_MAX_LENGTH = 80;

const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'by-slug',
  'explore',
  'me',
  'new',
  'pitchorium',
  'project',
  'projects',
  'public',
  'search',
  'settings',
  'showcase',
]);

export function slugBaseFromTitle(title: string): string {
  return slugify(title, {
    minLength: PROJECT_SLUG_MIN_LENGTH,
    maxLength: PROJECT_SLUG_MAX_LENGTH,
    fallback: 'project-page',
    reserved: RESERVED_SLUGS,
  });
}

export function assertSlugAllowed(slug: string): void {
  if (!PROJECT_SLUG_PATTERN.test(slug)) {
    throw new DomainError('VALIDATION_FAILED', 'Malformed project slug');
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new DomainError('PROJECTS_SLUG_RESERVED', 'Project slug is reserved');
  }
}
