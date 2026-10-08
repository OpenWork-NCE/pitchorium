import { Injectable, type OnModuleInit } from '@nestjs/common';
import { eq, sql } from '@pitchorium/db/orm';
import {
  organizationsInvitations,
  organizationsOrganizations,
} from '@pitchorium/db/schemas/organizations';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { type ErasureBlocker, ERASURE_ORDER, PrivacyFacade } from '../../privacy';
import { OrganizationEventsRecorder } from '../application/organization-events.recorder';
import { OrganizationRepository } from '../application/ports';
import { OrganizationDeleted } from '../domain/organization-events';

/**
 * Personal data of organizations: memberships, invitations sent or received, organizations
 * created. Erasure rules: the only owner of an organization that has other members transfers
 * the ownership first (PRIVACY_SOLE_OWNER); an organization whose only member is the erased
 * member is deleted; otherwise the membership is removed and the traces pseudonymized.
 */
@Injectable()
export class OrganizationsPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly organizations: OrganizationRepository,
    private readonly events: OrganizationEventsRecorder,
    private readonly media: MediaFacade,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'organizations',
      description:
        'The organizations you belong to with your role, the invitations you sent or received, and the organizations you created.',
      order: ERASURE_ORDER.ownership,
      exporter: {
        export: async (userId) => ({
          data: {
            memberships: await this.organizations.membershipsOf(userId),
            invitationsSent: await this.db
              .select({
                organizationId: organizationsInvitations.organizationId,
                email: organizationsInvitations.email,
                role: organizationsInvitations.role,
                status: organizationsInvitations.status,
                createdAt: organizationsInvitations.createdAt,
              })
              .from(organizationsInvitations)
              .where(eq(organizationsInvitations.invitedBy, userId)),
            created: await this.db
              .select({
                id: organizationsOrganizations.id,
                name: organizationsOrganizations.name,
                createdAt: organizationsOrganizations.createdAt,
              })
              .from(organizationsOrganizations)
              .where(eq(organizationsOrganizations.createdBy, userId)),
          },
        }),
      },
      eraser: {
        blockers: (userId) => this.blockers(userId),
        erase: async ({ userId, email, pseudonym }) => {
          for (const membership of await this.organizations.membershipsOf(userId)) {
            const members = await this.organizations.members(membership.organizationId);
            if (members.every((member) => member.userId === userId)) {
              await this.deleteOrganization(membership.organizationId, pseudonym);
            }
            await this.organizations.removeMember(membership.organizationId, userId);
          }
          await this.db
            .delete(organizationsInvitations)
            .where(sql`lower(${organizationsInvitations.email}) = ${email.toLowerCase()}`);
          await replaceIdentifier(
            this.db,
            [
              { table: 'organizations.invitations', column: 'invited_by' },
              { table: 'organizations.invitations', column: 'responded_by' },
              { table: 'organizations.verification_requests', column: 'requested_by' },
              { table: 'organizations.verification_requests', column: 'decided_by' },
              { table: 'organizations.organizations', column: 'created_by' },
            ],
            userId,
            pseudonym,
          );
        },
      },
    });
  }

  private async blockers(userId: string): Promise<ErasureBlocker[]> {
    const blockers: ErasureBlocker[] = [];
    for (const membership of await this.organizations.membershipsOf(userId)) {
      if (membership.role !== 'owner') continue;
      const members = await this.organizations.members(membership.organizationId);
      const otherOwners = members.some((m) => m.role === 'owner' && m.userId !== userId);
      const others = members.some((m) => m.userId !== userId);
      if (others && !otherOwners) {
        blockers.push({ code: 'PRIVACY_SOLE_OWNER', resourceId: membership.organizationId });
      }
    }
    return blockers;
  }

  /** As the deletion by its owner: page gone, slug reserved, files detached. */
  private async deleteOrganization(organizationId: string, pseudonym: string): Promise<void> {
    const organization = await this.organizations.findById(organizationId);
    if (!organization || organization.deletedAt) return;
    const now = this.clock.now();
    await this.organizations.update(organizationId, { deletedAt: now }, now);
    for (const mediaId of [organization.logoMediaId, organization.coverMediaId]) {
      if (mediaId) await this.media.detach(mediaId);
    }
    await this.organizations.revokePendingInvitations(organizationId);
    await this.events.record(OrganizationDeleted, organizationId, { deletedBy: pseudonym });
  }
}
