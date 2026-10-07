import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/kernel';
import { type InvitationRecord, isInvitationOpen } from '../domain/organization';
import { hashInvitationToken } from './invitations.service';
import { OrganizationRepository } from './ports';

/**
 * Worker side of invitations: the single-use token is created when the email is sent, so that
 * it never travels through the outbox; only its hash is stored. A resent email replaces it.
 */
@Injectable()
export class InvitationTokensService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly clock: Clock,
  ) {}

  /** Null when the invitation was answered, revoked or has expired meanwhile. */
  async issue(
    invitationId: string,
  ): Promise<{ token: string; invitation: InvitationRecord } | null> {
    const invitation = await this.organizations.findInvitation(invitationId);
    if (!invitation || !isInvitationOpen(invitation, this.clock.now())) return null;
    const token = randomBytes(32).toString('base64url');
    if (!(await this.organizations.setInvitationToken(invitationId, hashInvitationToken(token)))) {
      return null;
    }
    return { token, invitation };
  }
}
