import { Injectable } from '@nestjs/common';
import type {
  MyOrganization,
  Organization,
  OrganizationMemberCard,
  OrganizationRole,
} from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { ProfilesFacade } from '../../profiles';
import type { MemberRecord, OrganizationRecord } from '../domain/organization';
import { OrganizationProjectsRegistry } from './organization-projects.registry';
import { OrganizationRepository } from './ports';

export type OrganizationLookup =
  { kind: 'found'; view: Organization } | { kind: 'moved'; slug: string };

export const organizationNotFound = () =>
  new DomainError('ORGANIZATIONS_NOT_FOUND', 'Organization not found');

/**
 * Read side of organizations. The page is public (an organization is not personal data), but
 * its members follow their own privacy: visitors only see members with a public profile page.
 */
@Injectable()
export class OrganizationReadsService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly profiles: ProfilesFacade,
    private readonly media: MediaFacade,
    private readonly projects: OrganizationProjectsRegistry,
  ) {}

  /** Live organization or 404, including a deleted one. */
  async require(organizationId: string): Promise<OrganizationRecord> {
    const organization = await this.organizations.findById(organizationId);
    if (!organization || organization.deletedAt) throw organizationNotFound();
    return organization;
  }

  /** A former slug answers with the current one (redirect). `viewerId` null: a visitor. */
  async bySlug(slug: string, viewerId: string | null): Promise<OrganizationLookup> {
    const resolved = await this.organizations.resolveSlug(slug);
    if (!resolved) throw organizationNotFound();
    const organization = await this.require(resolved.organizationId);
    if (!resolved.current) return { kind: 'moved', slug: organization.slug };
    return { kind: 'found', view: await this.view(organization, viewerId) };
  }

  async byId(organizationId: string, viewerId: string): Promise<Organization> {
    return this.view(await this.require(organizationId), viewerId);
  }

  async mine(userId: string): Promise<MyOrganization[]> {
    const memberships = await this.organizations.membershipsOf(userId);
    const organizations = new Map(
      (await this.organizations.findByIds(memberships.map((member) => member.organizationId)))
        .filter((organization) => !organization.deletedAt)
        .map((organization) => [organization.id, organization]),
    );
    const logos = await this.media.images(
      [...organizations.values()].map((organization) => organization.logoMediaId),
    );
    return memberships.flatMap((membership) => {
      const organization = organizations.get(membership.organizationId);
      if (!organization) return [];
      return [
        {
          id: organization.id,
          slug: organization.slug,
          name: organization.name,
          logoUrl: organization.logoMediaId
            ? (logos.get(organization.logoMediaId)?.url ?? null)
            : null,
          verified: organization.verificationStatus === 'verified',
          role: membership.role,
        },
      ];
    });
  }

  private async view(
    organization: OrganizationRecord,
    viewerId: string | null,
  ): Promise<Organization> {
    const members = await this.organizations.members(organization.id);
    const [cards, images, projects] = await Promise.all([
      this.profiles.memberCards(members.map((member) => member.userId)),
      this.media.images([organization.logoMediaId, organization.coverMediaId]),
      this.projects.of(organization.id),
    ]);
    const viewerRole: OrganizationRole | null =
      (viewerId && members.find((member) => member.userId === viewerId)?.role) || null;
    const visible = (member: MemberRecord): OrganizationMemberCard[] => {
      const card = cards.get(member.userId);
      if (!card || (viewerId === null && !card.publicPageEnabled)) return [];
      return [
        {
          handle: card.handle,
          displayName: card.displayName,
          headline: card.headline,
          avatarUrl: card.avatarUrl,
          role: member.role,
        },
      ];
    };
    const url = (id: string | null) => (id ? (images.get(id)?.url ?? null) : null);
    return {
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
      structureType: organization.structureType,
      description: organization.description,
      countryCodes: organization.countryCodes,
      sectorCodes: organization.sectorCodes,
      websiteUrl: organization.websiteUrl,
      foundedYear: organization.foundedYear,
      logoUrl: url(organization.logoMediaId),
      logoMediaId: organization.logoMediaId,
      coverUrl: url(organization.coverMediaId),
      coverMediaId: organization.coverMediaId,
      verification: {
        status: organization.verificationStatus,
        verified: organization.verificationStatus === 'verified',
        verifiedAt:
          organization.verificationStatus === 'verified'
            ? (organization.verifiedAt?.toISOString() ?? null)
            : null,
      },
      members: members.flatMap(visible),
      projects,
      viewerRole,
      createdAt: organization.createdAt.toISOString(),
    };
  }
}
