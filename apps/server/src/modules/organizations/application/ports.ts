import type {
  InvitationStatus,
  OrganizationProjectRef,
  OrganizationRole,
  VerificationSignals,
} from '@pitchorium/contracts';
import type { InvitationRecord, MemberRecord, OrganizationRecord } from '../domain/organization';

export type VerificationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface VerificationRequestRecord {
  id: string;
  organizationId: string;
  requestedBy: string;
  declaration: string;
  documentMediaIds: string[];
  signals: VerificationSignals;
  status: VerificationRequestStatus;
  criteriaMet: string[];
  decisionReason: string | null;
  decidedBy: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

export type OrganizationPatch = Partial<
  Pick<
    OrganizationRecord,
    | 'name'
    | 'structureType'
    | 'description'
    | 'countryCodes'
    | 'sectorCodes'
    | 'websiteUrl'
    | 'foundedYear'
    | 'logoMediaId'
    | 'coverMediaId'
    | 'verificationStatus'
    | 'verifiedAt'
    | 'deletedAt'
  >
>;

export abstract class OrganizationRepository {
  /** Transaction-scoped lock on a key (creation limit of a member, roles of an organization). */
  abstract lock(key: string): Promise<void>;
  /** False when the slug is taken meanwhile; nothing is inserted then. */
  abstract insert(organization: OrganizationRecord): Promise<boolean>;
  /** Deleted organizations included: callers decide. */
  abstract findById(id: string): Promise<OrganizationRecord | null>;
  abstract findByIds(ids: readonly string[]): Promise<OrganizationRecord[]>;
  /** Current slug first, then former slugs (redirects). */
  abstract resolveSlug(slug: string): Promise<{ organizationId: string; current: boolean } | null>;
  /** Current or former slug of another organization. */
  abstract isSlugUnavailable(slug: string, forOrganizationId: string | null): Promise<boolean>;
  abstract update(id: string, patch: OrganizationPatch, now: Date): Promise<void>;
  abstract changeSlug(id: string, previous: string, next: string, now: Date): Promise<void>;
  abstract countCreatedBy(userId: string): Promise<number>;

  abstract addMember(member: MemberRecord): Promise<boolean>;
  abstract findMember(organizationId: string, userId: string): Promise<MemberRecord | null>;
  abstract members(organizationId: string): Promise<MemberRecord[]>;
  abstract membershipsOf(userId: string): Promise<MemberRecord[]>;
  abstract setRole(organizationId: string, userId: string, role: OrganizationRole): Promise<void>;
  abstract removeMember(organizationId: string, userId: string): Promise<boolean>;
  abstract countOwners(organizationId: string): Promise<number>;

  abstract insertInvitation(invitation: InvitationRecord): Promise<void>;
  abstract findInvitation(id: string): Promise<InvitationRecord | null>;
  abstract findInvitationByTokenHash(tokenHash: string): Promise<InvitationRecord | null>;
  abstract pendingInvitations(organizationId: string): Promise<InvitationRecord[]>;
  /** Revokes the pending invitations of an address (a new one replaces them). */
  abstract revokePendingInvitations(organizationId: string, email?: string): Promise<number>;
  /** Moves a pending invitation to `status`; false when it was not pending anymore. */
  abstract closeInvitation(
    id: string,
    status: Exclude<InvitationStatus, 'pending'>,
    now: Date,
    respondedBy: string | null,
  ): Promise<boolean>;
  /** Stores the hash of a new token on a pending invitation; false otherwise. */
  abstract setInvitationToken(id: string, tokenHash: string): Promise<boolean>;

  abstract insertVerificationRequest(request: VerificationRequestRecord): Promise<void>;
  abstract findVerificationRequest(id: string): Promise<VerificationRequestRecord | null>;
  abstract verificationRequests(
    status: VerificationRequestStatus,
    limit: number,
  ): Promise<VerificationRequestRecord[]>;
  /** Records the decision of a pending request; false when it was decided meanwhile. */
  abstract decideVerificationRequest(
    id: string,
    decision: Pick<
      VerificationRequestRecord,
      'status' | 'criteriaMet' | 'decisionReason' | 'decidedBy' | 'decidedAt'
    >,
  ): Promise<boolean>;
}

/**
 * Extension point filled by the projects and payments modules: projects carried or supported
 * by an organization (registered with OrganizationsFacade.registerProjectsProvider).
 */
export interface OrganizationProjectsProvider {
  carried(organizationId: string): Promise<OrganizationProjectRef[]>;
  supported(organizationId: string): Promise<OrganizationProjectRef[]>;
}
