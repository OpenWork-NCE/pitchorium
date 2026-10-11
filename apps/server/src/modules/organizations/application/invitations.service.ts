import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateInvitationRequest,
  Invitation,
  InvitationPreview,
  MyOrganization,
  ReceivedInvitation,
} from '@pitchorium/contracts';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { IdentityFacade } from '../../identity';
import { MediaFacade } from '../../media';
import { type InvitationRecord, isInvitationOpen, normalizeEmail } from '../domain/organization';
import { MemberInvited, MemberJoined } from '../domain/organization-events';
import { OrganizationEventsRecorder } from './organization-events.recorder';
import { OrganizationReadsService } from './organization-reads.service';
import { OrganizationRepository } from './ports';

export const hashInvitationToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const invalid = () =>
  new DomainError('ORGANIZATIONS_INVITATION_INVALID', 'Invitation is invalid or expired');

export function invitationView(invitation: InvitationRecord, now: Date): Invitation {
  const expired = invitation.status === 'pending' && !isInvitationOpen(invitation, now);
  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    email: invitation.email,
    role: invitation.role,
    status: expired ? 'expired' : invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}

/**
 * Invitations by email, for members and for people without an account. The single-use token
 * is created by the worker when the email is sent; only its hash is stored. Answering requires
 * an account whose verified email is the invited address.
 */
@Injectable()
export class InvitationsService {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly organizations: OrganizationRepository,
    private readonly reads: OrganizationReadsService,
    private readonly identity: IdentityFacade,
    private readonly media: MediaFacade,
    private readonly events: OrganizationEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async invite(
    organizationId: string,
    actorId: string,
    request: CreateInvitationRequest,
  ): Promise<Invitation> {
    await this.reads.require(organizationId);
    const email = normalizeEmail(request.email);
    const existing = await this.identity.findUserByEmail(email);
    if (existing && (await this.organizations.findMember(organizationId, existing.id))) {
      throw new DomainError('ORGANIZATIONS_ALREADY_MEMBER', 'Already a member');
    }
    const now = this.clock.now();
    const invitation: InvitationRecord = {
      id: this.ids.next(),
      organizationId,
      email,
      role: request.role,
      status: 'pending',
      invitedBy: actorId,
      expiresAt: new Date(now.getTime() + this.config.organizations.invitationTtlMs),
      createdAt: now,
    };
    await this.transactions.run(async () => {
      // A new invitation replaces the pending one of the same address.
      await this.organizations.revokePendingInvitations(organizationId, email);
      await this.organizations.insertInvitation(invitation);
      await this.events.record(MemberInvited, organizationId, {
        invitationId: invitation.id,
        role: invitation.role,
        invitedBy: actorId,
      });
    });
    return invitationView(invitation, now);
  }

  async pending(organizationId: string): Promise<Invitation[]> {
    await this.reads.require(organizationId);
    const now = this.clock.now();
    return (await this.organizations.pendingInvitations(organizationId)).map((invitation) =>
      invitationView(invitation, now),
    );
  }

  async revoke(organizationId: string, invitationId: string): Promise<void> {
    const invitation = await this.organizations.findInvitation(invitationId);
    if (!invitation || invitation.organizationId !== organizationId) throw invalid();
    if (
      !(await this.organizations.closeInvitation(invitationId, 'revoked', this.clock.now(), null))
    ) {
      throw invalid();
    }
  }

  /**
   * What a token received by email invites to, for the page of the invitation: no session is
   * needed, the token proves that the email reached its address. An invitation no longer open
   * answers like an unknown token (closed when it expired).
   */
  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.organizations.findInvitationByTokenHash(
      hashInvitationToken(token),
    );
    const now = this.clock.now();
    if (!invitation || !isInvitationOpen(invitation, now)) {
      if (invitation?.status === 'pending') {
        await this.organizations.closeInvitation(invitation.id, 'expired', now, null);
      }
      throw invalid();
    }
    const [received] = await this.present([invitation]);
    if (!received) throw invalid();
    return {
      organization: received.organization,
      role: received.role,
      expiresAt: received.expiresAt,
    };
  }

  /**
   * Open invitations sent to the verified email of the member (question 129), to answer from the
   * application without the token of the email; none while the email is not verified.
   */
  async received(userId: string): Promise<ReceivedInvitation[]> {
    const user = await this.identity.findUser(userId);
    if (!user?.emailVerified) return [];
    return this.present(
      await this.organizations.openInvitationsTo(normalizeEmail(user.email), this.clock.now()),
    );
  }

  /** Accepts an invitation of the list: same rules as with the token of the email. */
  async acceptReceived(userId: string, invitationId: string): Promise<MyOrganization> {
    return this.join(userId, await this.answerable(userId, invitationId, 'id'));
  }

  async declineReceived(userId: string, invitationId: string): Promise<void> {
    await this.close(userId, await this.answerable(userId, invitationId, 'id'));
  }

  /** The organization of each invitation, its public logo and its badge; deleted ones left out. */
  private async present(invitations: InvitationRecord[]): Promise<ReceivedInvitation[]> {
    const organizations = new Map(
      (
        await this.organizations.findByIds([
          ...new Set(invitations.map((invitation) => invitation.organizationId)),
        ])
      ).map((organization) => [organization.id, organization]),
    );
    const logos = await this.media.images(
      [...organizations.values()].map((organization) => organization.logoMediaId),
    );
    return invitations.flatMap((invitation) => {
      const organization = organizations.get(invitation.organizationId);
      if (!organization || organization.deletedAt) return [];
      return [
        {
          id: invitation.id,
          organization: {
            slug: organization.slug,
            name: organization.name,
            logoUrl: organization.logoMediaId
              ? (logos.get(organization.logoMediaId)?.url ?? null)
              : null,
            verified: organization.verificationStatus === 'verified',
          },
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
        },
      ];
    });
  }

  async accept(userId: string, token: string): Promise<MyOrganization> {
    return this.join(userId, await this.answerable(userId, token, 'token'));
  }

  private async join(userId: string, invitation: InvitationRecord): Promise<MyOrganization> {
    await this.transactions.run(async () => {
      await this.organizations.lock(`organizations:members:${invitation.organizationId}`);
      const now = this.clock.now();
      if (await this.organizations.findMember(invitation.organizationId, userId)) {
        throw new DomainError('ORGANIZATIONS_ALREADY_MEMBER', 'Already a member');
      }
      if (!(await this.organizations.closeInvitation(invitation.id, 'accepted', now, userId))) {
        throw invalid();
      }
      await this.organizations.addMember({
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
        joinedAt: now,
      });
      await this.events.record(MemberJoined, invitation.organizationId, {
        userId,
        role: invitation.role,
        invitationId: invitation.id,
      });
    });
    const joined = (await this.reads.mine(userId)).find(
      (organization) => organization.id === invitation.organizationId,
    );
    if (!joined) throw invalid();
    return joined;
  }

  async decline(userId: string, token: string): Promise<void> {
    await this.close(userId, await this.answerable(userId, token, 'token'));
  }

  private async close(userId: string, invitation: InvitationRecord): Promise<void> {
    if (
      !(await this.organizations.closeInvitation(
        invitation.id,
        'declined',
        this.clock.now(),
        userId,
      ))
    ) {
      throw invalid();
    }
  }

  /**
   * An open invitation, found by the token of its email or by its identifier (from the list of
   * the member), sent to the verified email of the member; any other answers like a closed one,
   * so that an identifier reveals nothing.
   */
  private async answerable(
    userId: string,
    key: string,
    by: 'token' | 'id',
  ): Promise<InvitationRecord> {
    const invitation =
      by === 'token'
        ? await this.organizations.findInvitationByTokenHash(hashInvitationToken(key))
        : await this.organizations.findInvitation(key);
    const now = this.clock.now();
    if (!invitation || !isInvitationOpen(invitation, now)) {
      if (invitation?.status === 'pending') {
        await this.organizations.closeInvitation(invitation.id, 'expired', now, null);
      }
      throw invalid();
    }
    const user = await this.identity.findUser(userId);
    if (by === 'id' && (!user?.emailVerified || normalizeEmail(user.email) !== invitation.email)) {
      throw invalid();
    }
    if (!user || normalizeEmail(user.email) !== invitation.email) {
      throw new DomainError(
        'ORGANIZATIONS_INVITATION_EMAIL_MISMATCH',
        'The invitation was sent to another address',
      );
    }
    const organization = await this.organizations.findById(invitation.organizationId);
    if (!organization || organization.deletedAt) throw invalid();
    return invitation;
  }
}
