import { Injectable } from '@nestjs/common';
import type {
  InvitableRole,
  InvitationStatus,
  OrganizationRole,
  StructureType,
  VerificationStatus,
} from '@pitchorium/contracts';
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, sql } from '@pitchorium/db/orm';
import {
  organizationsInvitations,
  organizationsMembers,
  organizationsOrganizations,
  organizationsSlugHistory,
  organizationsVerificationRequests,
} from '@pitchorium/db/schemas/organizations';
import { TransactionManager } from '../../../platform/database';
import type { InvitationRecord, MemberRecord, OrganizationRecord } from '../domain/organization';
import {
  OrganizationRepository,
  type OrganizationPatch,
  type VerificationRequestRecord,
  type VerificationRequestStatus,
} from '../application/ports';

type OrganizationRow = typeof organizationsOrganizations.$inferSelect;
type InvitationRow = typeof organizationsInvitations.$inferSelect;
type MemberRow = typeof organizationsMembers.$inferSelect;
type RequestRow = typeof organizationsVerificationRequests.$inferSelect;

const toOrganization = (row: OrganizationRow): OrganizationRecord => ({
  ...row,
  structureType: row.structureType as StructureType,
  verificationStatus: row.verificationStatus as VerificationStatus,
});

const toMember = (row: MemberRow): MemberRecord => ({
  ...row,
  role: row.role as OrganizationRole,
});

const toInvitation = (row: InvitationRow): InvitationRecord => ({
  id: row.id,
  organizationId: row.organizationId,
  email: row.email,
  role: row.role as InvitableRole,
  status: row.status as InvitationStatus,
  invitedBy: row.invitedBy,
  expiresAt: row.expiresAt,
  createdAt: row.createdAt,
});

const toRequest = (row: RequestRow): VerificationRequestRecord => ({
  ...row,
  status: row.status as VerificationRequestStatus,
});

/** Owners first, then admins, then members; by seniority inside a role. */
const ROLE_ORDER = sql`case ${organizationsMembers.role} when 'owner' then 0 when 'admin' then 1 else 2 end`;

@Injectable()
export class DrizzleOrganizationRepository extends OrganizationRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async lock(key: string): Promise<void> {
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async insert(organization: OrganizationRecord): Promise<boolean> {
    // No conflict target: a taken slug is reported instead of aborting the transaction.
    const inserted = await this.db
      .insert(organizationsOrganizations)
      .values(organization)
      .onConflictDoNothing()
      .returning({ id: organizationsOrganizations.id });
    return inserted.length > 0;
  }

  async findById(id: string): Promise<OrganizationRecord | null> {
    const [row] = await this.db
      .select()
      .from(organizationsOrganizations)
      .where(eq(organizationsOrganizations.id, id));
    return row ? toOrganization(row) : null;
  }

  async idsAfter(after: string | null, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ id: organizationsOrganizations.id })
      .from(organizationsOrganizations)
      .where(
        and(
          isNull(organizationsOrganizations.deletedAt),
          after ? gt(organizationsOrganizations.id, after) : undefined,
        ),
      )
      .orderBy(asc(organizationsOrganizations.id))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async findByIds(ids: readonly string[]): Promise<OrganizationRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(organizationsOrganizations)
      .where(inArray(organizationsOrganizations.id, [...ids]));
    return rows.map(toOrganization);
  }

  async slugsAfter(
    afterSlug: string | null,
    limit: number,
  ): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.db
      .select({
        slug: organizationsOrganizations.slug,
        updatedAt: organizationsOrganizations.updatedAt,
      })
      .from(organizationsOrganizations)
      .where(
        and(
          isNull(organizationsOrganizations.deletedAt),
          afterSlug ? gt(organizationsOrganizations.slug, afterSlug) : undefined,
        ),
      )
      .orderBy(asc(organizationsOrganizations.slug))
      .limit(limit);
  }

  async resolveSlug(slug: string): Promise<{ organizationId: string; current: boolean } | null> {
    const [current] = await this.db
      .select({ id: organizationsOrganizations.id })
      .from(organizationsOrganizations)
      .where(eq(organizationsOrganizations.slug, slug));
    if (current) return { organizationId: current.id, current: true };
    const [former] = await this.db
      .select({ id: organizationsSlugHistory.organizationId })
      .from(organizationsSlugHistory)
      .where(eq(organizationsSlugHistory.slug, slug));
    return former ? { organizationId: former.id, current: false } : null;
  }

  async isSlugUnavailable(slug: string, forOrganizationId: string | null): Promise<boolean> {
    const [current] = await this.db
      .select({ id: organizationsOrganizations.id })
      .from(organizationsOrganizations)
      .where(
        and(
          eq(organizationsOrganizations.slug, slug),
          forOrganizationId ? ne(organizationsOrganizations.id, forOrganizationId) : undefined,
        ),
      );
    if (current) return true;
    const [former] = await this.db
      .select({ id: organizationsSlugHistory.organizationId })
      .from(organizationsSlugHistory)
      .where(
        and(
          eq(organizationsSlugHistory.slug, slug),
          forOrganizationId
            ? ne(organizationsSlugHistory.organizationId, forOrganizationId)
            : undefined,
        ),
      );
    return former !== undefined;
  }

  async update(id: string, patch: OrganizationPatch, now: Date): Promise<void> {
    await this.db
      .update(organizationsOrganizations)
      .set({ ...patch, updatedAt: now })
      .where(eq(organizationsOrganizations.id, id));
  }

  async changeSlug(id: string, previous: string, next: string, now: Date): Promise<void> {
    // Taking back a former slug of the same organization removes it from the history.
    await this.db
      .delete(organizationsSlugHistory)
      .where(
        and(
          eq(organizationsSlugHistory.slug, next),
          eq(organizationsSlugHistory.organizationId, id),
        ),
      );
    await this.db
      .insert(organizationsSlugHistory)
      .values({ slug: previous, organizationId: id, replacedAt: now })
      .onConflictDoNothing();
    await this.db
      .update(organizationsOrganizations)
      .set({ slug: next, updatedAt: now })
      .where(eq(organizationsOrganizations.id, id));
  }

  async countCreatedBy(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(organizationsOrganizations)
      .where(
        and(
          eq(organizationsOrganizations.createdBy, userId),
          isNull(organizationsOrganizations.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async addMember(member: MemberRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(organizationsMembers)
      .values(member)
      .onConflictDoNothing()
      .returning({ userId: organizationsMembers.userId });
    return inserted.length > 0;
  }

  async findMember(organizationId: string, userId: string): Promise<MemberRecord | null> {
    const [row] = await this.db
      .select()
      .from(organizationsMembers)
      .where(
        and(
          eq(organizationsMembers.organizationId, organizationId),
          eq(organizationsMembers.userId, userId),
        ),
      );
    return row ? toMember(row) : null;
  }

  async members(organizationId: string): Promise<MemberRecord[]> {
    const rows = await this.db
      .select()
      .from(organizationsMembers)
      .where(eq(organizationsMembers.organizationId, organizationId))
      .orderBy(ROLE_ORDER, asc(organizationsMembers.joinedAt));
    return rows.map(toMember);
  }

  async membershipsOf(userId: string): Promise<MemberRecord[]> {
    const rows = await this.db
      .select()
      .from(organizationsMembers)
      .where(eq(organizationsMembers.userId, userId))
      .orderBy(asc(organizationsMembers.joinedAt));
    return rows.map(toMember);
  }

  async setRole(organizationId: string, userId: string, role: OrganizationRole): Promise<void> {
    await this.db
      .update(organizationsMembers)
      .set({ role })
      .where(
        and(
          eq(organizationsMembers.organizationId, organizationId),
          eq(organizationsMembers.userId, userId),
        ),
      );
  }

  async removeMember(organizationId: string, userId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(organizationsMembers)
      .where(
        and(
          eq(organizationsMembers.organizationId, organizationId),
          eq(organizationsMembers.userId, userId),
        ),
      )
      .returning({ userId: organizationsMembers.userId });
    return deleted.length > 0;
  }

  async countOwners(organizationId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(organizationsMembers)
      .where(
        and(
          eq(organizationsMembers.organizationId, organizationId),
          eq(organizationsMembers.role, 'owner'),
        ),
      );
    return row?.count ?? 0;
  }

  async insertInvitation(invitation: InvitationRecord): Promise<void> {
    await this.db.insert(organizationsInvitations).values(invitation);
  }

  async findInvitation(id: string): Promise<InvitationRecord | null> {
    const [row] = await this.db
      .select()
      .from(organizationsInvitations)
      .where(eq(organizationsInvitations.id, id));
    return row ? toInvitation(row) : null;
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
    const [row] = await this.db
      .select()
      .from(organizationsInvitations)
      .where(eq(organizationsInvitations.tokenHash, tokenHash));
    return row ? toInvitation(row) : null;
  }

  async pendingInvitations(organizationId: string): Promise<InvitationRecord[]> {
    const rows = await this.db
      .select()
      .from(organizationsInvitations)
      .where(
        and(
          eq(organizationsInvitations.organizationId, organizationId),
          eq(organizationsInvitations.status, 'pending'),
        ),
      )
      .orderBy(desc(organizationsInvitations.createdAt));
    return rows.map(toInvitation);
  }

  async countPendingInvitationsTo(email: string, now: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(organizationsInvitations)
      .innerJoin(
        organizationsOrganizations,
        eq(organizationsOrganizations.id, organizationsInvitations.organizationId),
      )
      .where(
        and(
          eq(organizationsInvitations.email, email),
          eq(organizationsInvitations.status, 'pending'),
          gt(organizationsInvitations.expiresAt, now),
          isNull(organizationsOrganizations.deletedAt),
        ),
      );
    return row?.value ?? 0;
  }

  async revokePendingInvitations(organizationId: string, email?: string): Promise<number> {
    const conditions = [
      eq(organizationsInvitations.organizationId, organizationId),
      eq(organizationsInvitations.status, 'pending'),
    ];
    if (email) conditions.push(eq(organizationsInvitations.email, email));
    const revoked = await this.db
      .update(organizationsInvitations)
      .set({ status: 'revoked' })
      .where(and(...conditions))
      .returning({ id: organizationsInvitations.id });
    return revoked.length;
  }

  async closeInvitation(
    id: string,
    status: Exclude<InvitationStatus, 'pending'>,
    now: Date,
    respondedBy: string | null,
  ): Promise<boolean> {
    const closed = await this.db
      .update(organizationsInvitations)
      .set({ status, respondedAt: now, respondedBy })
      .where(
        and(eq(organizationsInvitations.id, id), eq(organizationsInvitations.status, 'pending')),
      )
      .returning({ id: organizationsInvitations.id });
    return closed.length > 0;
  }

  async setInvitationToken(id: string, tokenHash: string): Promise<boolean> {
    const updated = await this.db
      .update(organizationsInvitations)
      .set({ tokenHash })
      .where(
        and(eq(organizationsInvitations.id, id), eq(organizationsInvitations.status, 'pending')),
      )
      .returning({ id: organizationsInvitations.id });
    return updated.length > 0;
  }

  async insertVerificationRequest(request: VerificationRequestRecord): Promise<void> {
    await this.db.insert(organizationsVerificationRequests).values(request);
  }

  async findVerificationRequest(id: string): Promise<VerificationRequestRecord | null> {
    const [row] = await this.db
      .select()
      .from(organizationsVerificationRequests)
      .where(eq(organizationsVerificationRequests.id, id));
    return row ? toRequest(row) : null;
  }

  async verificationRequests(
    status: VerificationRequestStatus,
    limit: number,
  ): Promise<VerificationRequestRecord[]> {
    const rows = await this.db
      .select()
      .from(organizationsVerificationRequests)
      .where(eq(organizationsVerificationRequests.status, status))
      .orderBy(asc(organizationsVerificationRequests.createdAt))
      .limit(limit);
    return rows.map(toRequest);
  }

  async verificationRequestsOf(
    organizationId: string,
    limit: number,
  ): Promise<VerificationRequestRecord[]> {
    const rows = await this.db
      .select()
      .from(organizationsVerificationRequests)
      .where(eq(organizationsVerificationRequests.organizationId, organizationId))
      .orderBy(desc(organizationsVerificationRequests.createdAt))
      .limit(limit);
    return rows.map(toRequest);
  }

  async decideVerificationRequest(
    id: string,
    decision: Pick<
      VerificationRequestRecord,
      'status' | 'criteriaMet' | 'decisionReason' | 'decidedBy' | 'decidedAt'
    >,
  ): Promise<boolean> {
    const decided = await this.db
      .update(organizationsVerificationRequests)
      .set(decision)
      .where(
        and(
          eq(organizationsVerificationRequests.id, id),
          eq(organizationsVerificationRequests.status, 'pending'),
        ),
      )
      .returning({ id: organizationsVerificationRequests.id });
    return decided.length > 0;
  }
}
