import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateVerificationRequest,
  OwnVerificationRequests,
  VerificationDecisionRequest,
  VerificationQueue,
  VerificationRequest,
  VerificationSignals,
} from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { IdentityFacade } from '../../identity';
import { MediaFacade } from '../../media';
import type { OrganizationRecord } from '../domain/organization';
import {
  VerificationApproved,
  VerificationRejected,
  VerificationRequested,
  VerificationRevoked,
} from '../domain/organization-events';
import {
  assertKnownCriteria,
  emailOnDomain,
  nextVerificationStatus,
  websiteDomain,
} from '../domain/verification';
import { OrganizationEventsRecorder } from './organization-events.recorder';
import { OrganizationReadsService } from './organization-reads.service';
import { OrganizationRepository, type VerificationRequestRecord } from './ports';

/** Supporting documents are attached to their request, a resource of this module. */
export const VERIFICATION_RESOURCE = 'organization_verification';
const QUEUE_LIMIT = 100;

const requestNotFound = () =>
  new DomainError('ORGANIZATIONS_VERIFICATION_REQUEST_NOT_FOUND', 'Verification request not found');

/**
 * Verification badge (ADR 0025): request by an owner with private documents and a declaration,
 * review by a moderator or an administrator, revocation. Every step is audited. The criteria
 * are configurable (ORGANIZATIONS_VERIFICATION_CRITERIA): the cahier des charges gives none.
 */
@Injectable()
export class VerificationService {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly organizations: OrganizationRepository,
    private readonly reads: OrganizationReadsService,
    private readonly identity: IdentityFacade,
    private readonly media: MediaFacade,
    private readonly audit: AuditService,
    private readonly events: OrganizationEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async request(
    organizationId: string,
    actorId: string,
    request: CreateVerificationRequest,
  ): Promise<VerificationRequest> {
    const organization = await this.reads.require(organizationId);
    const status = nextVerificationStatus(organization.verificationStatus, 'request');
    const signals = await this.signals(organization);
    const now = this.clock.now();
    const record: VerificationRequestRecord = {
      id: this.ids.next(),
      organizationId,
      requestedBy: actorId,
      declaration: request.declaration,
      documentMediaIds: request.documentMediaIds,
      signals,
      status: 'pending',
      criteriaMet: [],
      decisionReason: null,
      decidedBy: null,
      createdAt: now,
      decidedAt: null,
    };
    await this.transactions.run(async () => {
      await this.organizations.lock(`organizations:verification:${organizationId}`);
      const current = await this.organizations.findById(organizationId);
      if (current?.verificationStatus !== organization.verificationStatus) {
        throw new DomainError('ORGANIZATIONS_VERIFICATION_INVALID_STATE', 'Status changed');
      }
      await this.organizations.insertVerificationRequest(record);
      for (const mediaId of request.documentMediaIds) {
        await this.media.attach({
          mediaId,
          ownerId: actorId,
          usage: 'verification_document',
          resource: { type: VERIFICATION_RESOURCE, id: record.id },
        });
      }
      await this.organizations.update(organizationId, { verificationStatus: status }, now);
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'organizations.verification-requested',
        target: { type: 'organization', id: organizationId },
        metadata: { requestId: record.id, documents: request.documentMediaIds.length, signals },
      });
      await this.events.record(VerificationRequested, organizationId, {
        requestId: record.id,
        requestedBy: actorId,
      });
    });
    return this.view(record, { ...organization, verificationStatus: status });
  }

  async queue(status: VerificationRequestRecord['status']): Promise<VerificationQueue> {
    const requests = await this.organizations.verificationRequests(status, QUEUE_LIMIT);
    const organizations = new Map(
      (await this.organizations.findByIds(requests.map((request) => request.organizationId))).map(
        (organization) => [organization.id, organization],
      ),
    );
    return {
      items: requests.flatMap((request) => {
        const organization = organizations.get(request.organizationId);
        return organization ? [this.view(request, organization)] : [];
      }),
      criteria: this.config.organizations.verificationCriteria,
    };
  }

  /**
   * The requests of an organization as its owners and admins follow them: state, documents
   * counted and motivation of a decision; the reviewers stay unnamed.
   */
  async history(organizationId: string): Promise<OwnVerificationRequests> {
    await this.reads.require(organizationId);
    const requests = await this.organizations.verificationRequestsOf(organizationId, QUEUE_LIMIT);
    return {
      items: requests.map((request) => ({
        id: request.id,
        status: request.status,
        declaration: request.declaration,
        documentCount: request.documentMediaIds.length,
        decisionReason: request.decisionReason,
        createdAt: request.createdAt.toISOString(),
        decidedAt: request.decidedAt?.toISOString() ?? null,
      })),
    };
  }

  async get(requestId: string): Promise<VerificationRequest> {
    const request = await this.organizations.findVerificationRequest(requestId);
    if (!request) throw requestNotFound();
    const organization = await this.organizations.findById(request.organizationId);
    if (!organization) throw requestNotFound();
    return this.view(request, organization);
  }

  /** Approval or rejection, motivated; the criteria ticked must be configured ones. */
  async decide(
    requestId: string,
    reviewerId: string,
    decision: VerificationDecisionRequest,
  ): Promise<VerificationRequest> {
    assertKnownCriteria(decision.criteriaMet, this.config.organizations.verificationCriteria);
    const request = await this.organizations.findVerificationRequest(requestId);
    if (!request) throw requestNotFound();
    const approved = decision.decision === 'approved';
    await this.transactions.run(async () => {
      await this.organizations.lock(`organizations:verification:${request.organizationId}`);
      const organization = await this.reads.require(request.organizationId);
      const status = nextVerificationStatus(
        organization.verificationStatus,
        approved ? 'approve' : 'reject',
      );
      const now = this.clock.now();
      const decided = await this.organizations.decideVerificationRequest(requestId, {
        status: decision.decision,
        criteriaMet: decision.criteriaMet,
        decisionReason: decision.reason,
        decidedBy: reviewerId,
        decidedAt: now,
      });
      if (!decided) {
        throw new DomainError('ORGANIZATIONS_VERIFICATION_INVALID_STATE', 'Already decided');
      }
      await this.organizations.update(
        organization.id,
        { verificationStatus: status, verifiedAt: approved ? now : organization.verifiedAt },
        now,
      );
      await this.audit.record({
        actor: { type: 'user', id: reviewerId },
        action: approved
          ? 'organizations.verification-approved'
          : 'organizations.verification-rejected',
        target: { type: 'organization', id: organization.id },
        metadata: { requestId, reason: decision.reason, criteriaMet: decision.criteriaMet },
      });
      const payload = { requestId, decidedBy: reviewerId };
      if (approved) await this.events.record(VerificationApproved, organization.id, payload);
      else await this.events.record(VerificationRejected, organization.id, payload);
    });
    return this.get(requestId);
  }

  async revoke(organizationId: string, reviewerId: string, reason: string): Promise<void> {
    await this.transactions.run(async () => {
      await this.organizations.lock(`organizations:verification:${organizationId}`);
      const organization = await this.reads.require(organizationId);
      const status = nextVerificationStatus(organization.verificationStatus, 'revoke');
      await this.organizations.update(
        organizationId,
        { verificationStatus: status },
        this.clock.now(),
      );
      await this.audit.record({
        actor: { type: 'user', id: reviewerId },
        action: 'organizations.verification-revoked',
        target: { type: 'organization', id: organizationId },
        metadata: { reason },
      });
      await this.events.record(VerificationRevoked, organizationId, {
        revokedBy: reviewerId,
        reason,
      });
    });
  }

  /** Non-decisive signal: a member has a verified email on the website domain. */
  private async signals(organization: OrganizationRecord): Promise<VerificationSignals> {
    const domain = websiteDomain(organization.websiteUrl);
    let match = false;
    if (domain) {
      for (const member of await this.organizations.members(organization.id)) {
        const user = await this.identity.findUser(member.userId);
        if (user?.emailVerified && emailOnDomain(user.email, domain)) {
          match = true;
          break;
        }
      }
    }
    return { websiteDomain: domain, memberEmailOnWebsiteDomain: match };
  }

  private view(
    request: VerificationRequestRecord,
    organization: OrganizationRecord,
  ): VerificationRequest {
    return {
      id: request.id,
      organization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        websiteUrl: organization.websiteUrl,
        verificationStatus: organization.verificationStatus,
      },
      requestedBy: request.requestedBy,
      declaration: request.declaration,
      documentMediaIds: request.documentMediaIds,
      signals: request.signals,
      status: request.status,
      criteriaMet: request.criteriaMet,
      decisionReason: request.decisionReason,
      decidedBy: request.decidedBy,
      createdAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() ?? null,
    };
  }
}
