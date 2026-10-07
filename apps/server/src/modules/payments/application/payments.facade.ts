import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ContributionKind, ContributionStatus, Refund } from '@pitchorium/contracts';
import { AccessFacade } from '../../access';
import { IdentityFacade } from '../../identity';
import { MediaFacade, type MediaResourceRef } from '../../media';
import { OrganizationsFacade } from '../../organizations';
import { ProjectsFacade } from '../../projects';
import { type ContributionRecord, netEurMinor } from '../domain/contribution';
import { OFFLINE_CONTRIBUTION_RESOURCE, OfflineService } from './offline.service';
import { KYC_SUBMISSION_RESOURCE, PayoutService } from './payout.service';
import { PaymentsRepository } from './ports';
import { RefundsService } from './refunds.service';

/** What the engagement module projects of a contribution (ADR 0053). */
export interface ContributionFacts {
  contributionId: string;
  contributorId: string;
  organizationId: string | null;
  projectId: string;
  kind: ContributionKind;
  status: ContributionStatus;
  /** EUR equivalent given, net of refunds and lost disputes; 0 before success. */
  netEurMinor: bigint;
  succeededAt: Date | null;
  /** The contributor accepted to be shown and did not give anonymously. */
  named: boolean;
}

const facts = (row: ContributionRecord): ContributionFacts => ({
  contributionId: row.id,
  contributorId: row.contributorId,
  organizationId: row.organizationId,
  projectId: row.projectId,
  kind: row.kind,
  status: row.status,
  netEurMinor: netEurMinor(row),
  succeededAt: row.succeededAt,
  named: row.publicDisplay && !row.anonymous,
});

/**
 * Public facade of the payments module. At startup it gives access the KYC status of the
 * holders and the `payout_account` prerequisite, organizations the projects they supported and
 * media the read rules of the KYC documents and of the proofs of off-platform contributions.
 */
@Injectable()
export class PaymentsFacade implements OnModuleInit {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly payout: PayoutService,
    private readonly offline: OfflineService,
    private readonly refunds: RefundsService,
    private readonly access: AccessFacade,
    private readonly identity: IdentityFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly projects: ProjectsFacade,
    private readonly media: MediaFacade,
  ) {}

  onModuleInit(): void {
    this.access.registerKycStatusProvider({
      isVerified: (userId) => this.payout.isKycVerified(userId),
    });
    this.access.registerPrerequisiteProvider({
      elements: ['payout_account'],
      missing: async (userId) => {
        const account = await this.payments.findPayoutAccount(userId);
        return account?.status === 'active' ? [] : ['payout_account'];
      },
    });
    this.organizations.registerProjectsProvider({
      carried: () => Promise.resolve([]),
      supported: async (organizationId) => {
        const ids = await this.payments.projectsSupportedBy(organizationId);
        const projects = await this.projects.fundables(ids);
        return [...projects.values()]
          .filter((project) => project.showable)
          .map((project) => ({ projectId: project.id, slug: project.slug, title: project.title }));
      },
    });
    this.media.registerReadAuthorizer({
      resourceTypes: [KYC_SUBMISSION_RESOURCE, OFFLINE_CONTRIBUTION_RESOURCE],
      canRead: (viewerId, resource) => this.canReadFile(viewerId, resource),
    });
  }

  async contributionFacts(ids: readonly string[]): Promise<ContributionFacts[]> {
    const rows = await Promise.all(ids.map((id) => this.payments.findContribution(id)));
    return rows.flatMap((row) => (row ? [facts(row)] : []));
  }

  /** Every contribution, by identifier order: the replay of the engagement projection. */
  async contributionFactsAfter(
    afterId: string | null,
    limit: number,
  ): Promise<ContributionFacts[]> {
    return (await this.payments.allContributions(afterId, limit)).map(facts);
  }

  /** Members whose paid contributions to the project still count (notifications). */
  contributorIds(projectId: string): Promise<string[]> {
    return this.payments.contributorIdsOf(projectId);
  }

  /** Parties of an off-platform contribution (notifications). */
  async offlineParties(id: string): Promise<{
    projectId: string;
    contributorId: string;
    declaredBy: 'contributor' | 'holder';
    declarerId: string;
  } | null> {
    const found = await this.payments.findOffline(id);
    return found
      ? {
          projectId: found.projectId,
          contributorId: found.contributorId,
          declaredBy: found.declaredBy,
          declarerId: found.declarerId,
        }
      : null;
  }

  /** Refund decided by the moderation (trust module), whatever remains. */
  refundForModeration(contributionId: string, reason: string): Promise<Refund> {
    return this.refunds.refund(contributionId, { reason, requestedBy: null, origin: 'moderation' });
  }

  /**
   * KYC documents: the holder and administrators with two-factor authentication. Proofs of an
   * off-platform contribution: its parties and the same administrators.
   */
  private async canReadFile(viewerId: string, resource: MediaResourceRef): Promise<boolean> {
    if (resource.type === KYC_SUBMISSION_RESOURCE) {
      const submission = await this.payments.findKycSubmission(resource.id);
      if (!submission) return false;
      if (submission.userId === viewerId) return true;
    } else {
      const record = await this.payments.findOffline(resource.id);
      if (!record) return false;
      if (await this.offline.isParty(record, viewerId)) return true;
    }
    const roles = await this.access.rolesOf(viewerId);
    if (!roles.includes('admin')) return false;
    return (await this.identity.findUser(viewerId))?.twoFactorEnabled ?? false;
  }
}
