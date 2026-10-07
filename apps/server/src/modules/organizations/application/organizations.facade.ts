import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type OrganizationRole, type StructureType, uuidV7Schema } from '@pitchorium/contracts';
import { AccessFacade } from '../../access';
import { IdentityFacade } from '../../identity';
import { MediaFacade, type MediaResourceRef } from '../../media';
import { NetworkFacade } from '../../network';
import { type OrganizationSummary, ProfilesFacade } from '../../profiles';
import { OrganizationProjectsRegistry } from './organization-projects.registry';
import { type OrganizationProjectsProvider, OrganizationRepository } from './ports';
import { VERIFICATION_RESOURCE } from './verification.service';

const REVIEWER_ROLES: readonly string[] = ['moderator', 'admin'];

/** Follow target type of organizations in the network module. */
export const ORGANIZATION_FOLLOW_TARGET = 'organization';

/** How an organization appears on another module's page (author of a post, followed target). */
export interface OrganizationCard {
  id: string;
  slug: string;
  name: string;
  structureType: StructureType;
  logoUrl: string | null;
  verified: boolean;
}

/**
 * Public facade of the organizations module. At startup it gives profiles the organization
 * directory (contributor facet link), media the read rule of verification documents and network
 * the `organization` follow target.
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
    private readonly network: NetworkFacade,
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
    this.network.registerFollowTargetType({
      type: ORGANIZATION_FOLLOW_TARGET,
      resolve: async (key) => {
        if (!uuidV7Schema.safeParse(key).success) return null;
        const organization = await this.organizations.findById(key);
        return organization && !organization.deletedAt ? organization.id : null;
      },
      describe: async (ids) =>
        new Map(
          [...(await this.cards(ids)).values()].map((card) => [
            card.id,
            {
              key: card.id,
              displayName: card.name,
              subtitle: card.structureType,
              imageUrl: card.logoUrl,
            },
          ]),
        ),
    });
  }

  /** Identifiers of live organizations by current slug (mentions `@slug`). */
  async idsBySlugs(slugs: readonly string[]): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const slug of new Set(slugs)) {
      const resolved = await this.organizations.resolveSlug(slug);
      if (!resolved?.current) continue;
      const organization = await this.organizations.findById(resolved.organizationId);
      if (organization && !organization.deletedAt) ids.set(slug, organization.id);
    }
    return ids;
  }

  /** Cards of live organizations, with their public logo, by id. */
  async cards(ids: readonly string[]): Promise<Map<string, OrganizationCard>> {
    const organizations = (await this.organizations.findByIds(ids)).filter(
      (organization) => !organization.deletedAt,
    );
    const logos = await this.media.images(
      organizations.map((organization) => organization.logoMediaId),
    );
    return new Map(
      organizations.map((organization) => [
        organization.id,
        {
          id: organization.id,
          slug: organization.slug,
          name: organization.name,
          structureType: organization.structureType,
          logoUrl: organization.logoMediaId
            ? (logos.get(organization.logoMediaId)?.url ?? null)
            : null,
          verified: organization.verificationStatus === 'verified',
        },
      ]),
    );
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
