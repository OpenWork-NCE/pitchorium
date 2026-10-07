import { Injectable } from '@nestjs/common';
import { DEFAULT_LOCALE, type OrganizationRole } from '@pitchorium/contracts';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { IdentityFacade } from '../../identity';
import { InvitationTokensService } from '../application/invitation-tokens.service';
import { OrganizationRepository } from '../application/ports';
import type { OrganizationRecord } from '../domain/organization';
import {
  MemberInvited,
  MemberJoined,
  MemberRoleChanged,
  OwnershipTransferred,
  VerificationApproved,
  VerificationRejected,
  VerificationRequested,
  VerificationRevoked,
} from '../domain/organization-events';
import {
  formatUtc,
  OrganizationMailer,
  type Recipient,
} from '../infrastructure/organization-mailer';

const text = (payload: OutboxEnvelope['payload'], key: string) => {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
};

/**
 * Organization emails (worker): invitation with its single-use token, acceptance, role change,
 * ownership transfer and the verification steps, in the recipient's locale.
 */
@Injectable()
@DomainEventHandler({
  name: 'organizations.send-emails',
  eventTypes: [
    MemberInvited.TYPE,
    MemberJoined.TYPE,
    MemberRoleChanged.TYPE,
    OwnershipTransferred.TYPE,
    VerificationRequested.TYPE,
    VerificationApproved.TYPE,
    VerificationRejected.TYPE,
    VerificationRevoked.TYPE,
  ],
})
export class OrganizationEmailsHandler implements DomainEventSubscriber {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly tokens: InvitationTokensService,
    private readonly identity: IdentityFacade,
    private readonly mailer: OrganizationMailer,
  ) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    const organization = await this.organizations.findById(event.aggregateId);
    if (!organization || organization.deletedAt) return;
    const { payload } = event;
    const base = {
      organization: organization.name,
      actionUrl: this.mailer.organizationUrl(organization.slug),
    };
    switch (event.type) {
      case MemberInvited.TYPE:
        return this.sendInvitation(organization, text(payload, 'invitationId'));
      case MemberJoined.TYPE: {
        const joined = await this.identity.findUser(text(payload, 'userId'));
        const invitation = await this.organizations.findInvitation(text(payload, 'invitationId'));
        const recipients = new Set(await this.owners(organization.id));
        if (invitation) recipients.add(invitation.invitedBy);
        recipients.delete(text(payload, 'userId'));
        return this.sendTo([...recipients], {
          ...base,
          kind: 'invitation_accepted',
          member: joined?.name ?? '',
          role: payload['role'] as OrganizationRole,
        });
      }
      case MemberRoleChanged.TYPE:
        return this.sendTo([text(payload, 'userId')], {
          ...base,
          kind: 'role_changed',
          role: payload['role'] as OrganizationRole,
        });
      case OwnershipTransferred.TYPE: {
        const newOwner = await this.identity.findUser(text(payload, 'toUserId'));
        return this.sendTo([text(payload, 'toUserId'), text(payload, 'fromUserId')], {
          ...base,
          kind: 'ownership_transferred',
          member: newOwner?.name ?? '',
        });
      }
      case VerificationRequested.TYPE:
        return this.sendTo(await this.owners(organization.id), {
          ...base,
          kind: 'verification_requested',
        });
      case VerificationApproved.TYPE:
      case VerificationRejected.TYPE: {
        const request = await this.organizations.findVerificationRequest(
          text(payload, 'requestId'),
        );
        return this.sendTo(await this.owners(organization.id), {
          ...base,
          kind:
            event.type === VerificationApproved.TYPE
              ? 'verification_approved'
              : 'verification_rejected',
          reason: request?.decisionReason ?? undefined,
        });
      }
      case VerificationRevoked.TYPE:
        return this.sendTo(await this.owners(organization.id), {
          ...base,
          kind: 'verification_revoked',
          reason: text(payload, 'reason'),
        });
    }
  }

  /** The address may have no account yet: then the email is in the default locale. */
  private async sendInvitation(organization: OrganizationRecord, invitationId: string) {
    const issued = await this.tokens.issue(invitationId);
    if (!issued) return;
    const { token, invitation } = issued;
    const [account, inviter] = await Promise.all([
      this.identity.findUserByEmail(invitation.email),
      this.identity.findUser(invitation.invitedBy),
    ]);
    await this.mailer.send(
      {
        email: invitation.email,
        name: account?.name ?? null,
        locale: account?.locale ?? DEFAULT_LOCALE,
      },
      {
        kind: 'invitation',
        organization: organization.name,
        actionUrl: this.mailer.invitationUrl(token),
        role: invitation.role,
        member: inviter?.name ?? organization.name,
        expiresAt: formatUtc(invitation.expiresAt),
      },
    );
  }

  private async owners(organizationId: string): Promise<string[]> {
    return (await this.organizations.members(organizationId))
      .filter((member) => member.role === 'owner')
      .map((member) => member.userId);
  }

  private async sendTo(
    userIds: readonly string[],
    notice: Parameters<OrganizationMailer['send']>[1],
  ): Promise<void> {
    for (const userId of new Set(userIds)) {
      const user = await this.identity.findUser(userId);
      if (!user) continue;
      const to: Recipient = { email: user.email, name: user.name, locale: user.locale };
      await this.mailer.send(to, notice);
    }
  }
}
