import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { OrganizationRole } from '@pitchorium/contracts';
import { AccessFacade } from '../../access';
import { IdentityFacade } from '../../identity';
import { MediaFacade, type MediaResourceRef } from '../../media';
import { type OrganizationSummary, ProfilesFacade } from '../../profiles';
import { OrganizationProjectsRegistry } from './organization-projects.registry';
import { type OrganizationProjectsProvider, OrganizationRepository } from './ports';
import { VERIFICATION_RESOURCE } from './verification.service';

const REVIEWER_ROLES: readonly string[] = ['moderator', 'admin'];

/**
 * Public facade of the organizations module. At startup it gives profiles the organization
 * directory (contributor facet link) and media the read rule of verification documents.
 */
@Injectable()
export class OrganizationsFacade implements OnModuleInit {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly projects: OrganizationProjectsRegistry,
    private readonly profiles: ProfilesFacade,
    private readonly media: MediaFacade,
    private readonly access: AccessFacade,
    private readonly identity: IdentityFacade,
  ) {}

  onModuleInit(): void {
    this.profiles.registerOrganizationDirectory({
      isMember: async (organizationId, userId) =>
        (await this.roleOf(organizationId, userId)) !== null,
      summaries: (ids) => this.summaries(ids),
    });
    this.media.registerReadAuthorizer({
      resourceTypes: [VERIFICATION_RESOURCE],
      canRead: (viewerId, resource) => this.canReadVerificationDocument(viewerId, resource),
    });
  }

  /** Role of a member in a live organization, null otherwise. */
  async roleOf(organizationId: string, userId: string): Promise<OrganizationRole | null> {
    const organization = await this.organizations.findById(organizationId);
    if (!organization || organization.deletedAt) return null;
    return (await this.organizations.findMember(organizationId, userId))?.role ?? null;
  }

  async summaries(ids: readonly string[]): Promise<Map<string, OrganizationSummary>> {
    const summaries = new Map<string, OrganizationSummary>();
    for (const organization of await this.organizations.findByIds(ids)) {
      if (organization.deletedAt) continue;
      summaries.set(organization.id, {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        verified: organization.verificationStatus === 'verified',
      });
    }
    return summaries;
  }

  /** Extension point for the projects and payments modules (carried and supported projects). */
  registerProjectsProvider(provider: OrganizationProjectsProvider): void {
    this.projects.register(provider);
  }

  /**
   * Supporting documents are read by the owners and admins of the organization, and by
   * moderators and administrators of the platform with two-factor authentication.
   */
  private async canReadVerificationDocument(
    viewerId: string,
    resource: MediaResourceRef,
  ): Promise<boolean> {
    const request = await this.organizations.findVerificationRequest(resource.id);
    if (!request) return false;
    const role = await this.roleOf(request.organizationId, viewerId);
    if (role === 'owner' || role === 'admin') return true;
    const roles = await this.access.rolesOf(viewerId);
    if (!roles.some((platformRole) => REVIEWER_ROLES.includes(platformRole))) return false;
    return (await this.identity.findUser(viewerId))?.twoFactorEnabled ?? false;
  }
}
