import {
  type InvitableRole,
  type InvitationStatus,
  ORGANIZATION_SLUG_MAX_LENGTH,
  ORGANIZATION_SLUG_MIN_LENGTH,
  ORGANIZATION_SLUG_PATTERN,
  type OrganizationRole,
  type StructureType,
  type VerificationStatus,
} from '@pitchorium/contracts';
import { DomainError, slugify } from '../../../platform/kernel';

export interface OrganizationRecord {
  id: string;
  slug: string;
  name: string;
  structureType: StructureType;
  description: string | null;
  countryCodes: string[];
  sectorCodes: string[];
  websiteUrl: string | null;
  foundedYear: number | null;
  logoMediaId: string | null;
  coverMediaId: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface MemberRecord {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  joinedAt: Date;
}

export interface InvitationRecord {
  id: string;
  organizationId: string;
  email: string;
  role: InvitableRole;
  status: InvitationStatus;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Words that would collide with routes or impersonate the platform. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'auth',
  'help',
  'invitations',
  'me',
  'new',
  'organization',
  'organizations',
  'pitchorium',
  'public',
  'search',
  'settings',
  'support',
  'verification',
  'verifications',
]);

export function slugBaseFromName(name: string): string {
  return slugify(name, {
    minLength: ORGANIZATION_SLUG_MIN_LENGTH,
    maxLength: ORGANIZATION_SLUG_MAX_LENGTH,
    fallback: 'organization-page',
    reserved: RESERVED_SLUGS,
  });
}

export function assertSlugAllowed(slug: string): void {
  if (!ORGANIZATION_SLUG_PATTERN.test(slug)) {
    throw new DomainError('VALIDATION_FAILED', 'Malformed organization slug');
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new DomainError('ORGANIZATIONS_SLUG_RESERVED', 'Organization slug is reserved');
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A pending invitation can be answered until it expires. */
export function isInvitationOpen(invitation: InvitationRecord, now: Date): boolean {
  return invitation.status === 'pending' && invitation.expiresAt.getTime() > now.getTime();
}
