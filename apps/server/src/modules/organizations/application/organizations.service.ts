import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CreateOrganizationRequest, UpdateOrganizationRequest } from '@pitchorium/contracts';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator, slugCandidates } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { ProfilesFacade } from '../../profiles';
import {
  assertSlugAllowed,
  type OrganizationRecord,
  slugBaseFromName,
} from '../domain/organization';
import {
  OrganizationCreated,
  OrganizationDeleted,
  OrganizationUpdated,
} from '../domain/organization-events';
import { OrganizationEventsRecorder } from './organization-events.recorder';
import { OrganizationReadsService } from './organization-reads.service';
import { OrganizationRepository } from './ports';

export type OrganizationImageSlot = 'logo' | 'cover';

/** Write side of organization pages. Every write records its event in the same transaction. */
@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly organizations: OrganizationRepository,
    private readonly reads: OrganizationReadsService,
    private readonly profiles: ProfilesFacade,
    private readonly media: MediaFacade,
    private readonly events: OrganizationEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** The creator becomes owner. Limited per member (ORGANIZATIONS_MAX_CREATED_PER_USER). */
  async create(userId: string, request: CreateOrganizationRequest): Promise<OrganizationRecord> {
    await this.profiles.assertCountries(request.countryCodes);
    await this.profiles.assertSectors(request.sectorCodes ?? []);
    return this.transactions.run(async () => {
      await this.organizations.lock(`organizations:creator:${userId}`);
      if (
        (await this.organizations.countCreatedBy(userId)) >=
        this.config.organizations.maxCreatedPerUser
      ) {
        throw new DomainError(
          'ORGANIZATIONS_CREATION_LIMIT_REACHED',
          'Maximum number of created organizations reached',
        );
      }
      const base = slugBaseFromName(request.name);
      for (const slug of slugCandidates(base, () => randomInt(1000, 1_000_000))) {
        if (await this.organizations.isSlugUnavailable(slug, null)) continue;
        const now = this.clock.now();
        const organization: OrganizationRecord = {
          id: this.ids.next(),
          slug,
          name: request.name,
          structureType: request.structureType,
          description: request.description ?? null,
          countryCodes: request.countryCodes,
          sectorCodes: request.sectorCodes ?? [],
          websiteUrl: request.websiteUrl ?? null,
          foundedYear: request.foundedYear ?? null,
          logoMediaId: null,
          coverMediaId: null,
          verificationStatus: 'unverified',
          verifiedAt: null,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        if (!(await this.organizations.insert(organization))) continue;
        await this.organizations.addMember({
          organizationId: organization.id,
          userId,
          role: 'owner',
          joinedAt: now,
        });
        await this.events.record(OrganizationCreated, organization.id, { slug, createdBy: userId });
        return organization;
      }
      throw new Error(`No slug available for organization ${request.name}`);
    });
  }

  async update(organizationId: string, patch: UpdateOrganizationRequest): Promise<void> {
    await this.reads.require(organizationId);
    const fields = Object.keys(patch);
    if (fields.length === 0) return;
    if (patch.countryCodes) await this.profiles.assertCountries(patch.countryCodes);
    if (patch.sectorCodes) await this.profiles.assertSectors(patch.sectorCodes);
    await this.transactions.run(async () => {
      await this.organizations.update(organizationId, patch, this.clock.now());
      await this.events.record(OrganizationUpdated, organizationId, { fields: fields.sort() });
    });
  }

  /** Former slugs keep redirecting and are never given to another organization. */
  async changeSlug(organizationId: string, slug: string): Promise<void> {
    const organization = await this.reads.require(organizationId);
    assertSlugAllowed(slug);
    if (organization.slug === slug) return;
    if (await this.organizations.isSlugUnavailable(slug, organizationId)) {
      throw new DomainError('ORGANIZATIONS_SLUG_TAKEN', 'Organization slug is already taken');
    }
    await this.transactions.run(async () => {
      await this.organizations.changeSlug(
        organizationId,
        organization.slug,
        slug,
        this.clock.now(),
      );
      await this.events.record(OrganizationUpdated, organizationId, { fields: ['slug'] });
    });
  }

  /** Attaches a ready file uploaded by the acting member; the previous one is detached. */
  async setImage(
    organizationId: string,
    actorId: string,
    slot: OrganizationImageSlot,
    mediaId: string,
  ): Promise<void> {
    const organization = await this.reads.require(organizationId);
    const current = slot === 'logo' ? organization.logoMediaId : organization.coverMediaId;
    if (current === mediaId) return;
    await this.transactions.run(async () => {
      if (current) await this.media.detach(current);
      await this.media.attach({
        mediaId,
        ownerId: actorId,
        usage: slot === 'logo' ? 'organization_logo' : 'organization_cover',
        resource: { type: 'organization', id: organizationId },
      });
      await this.organizations.update(
        organizationId,
        slot === 'logo' ? { logoMediaId: mediaId } : { coverMediaId: mediaId },
        this.clock.now(),
      );
      await this.events.record(OrganizationUpdated, organizationId, { fields: [slot] });
    });
  }

  async removeImage(organizationId: string, slot: OrganizationImageSlot): Promise<void> {
    const organization = await this.reads.require(organizationId);
    const current = slot === 'logo' ? organization.logoMediaId : organization.coverMediaId;
    if (!current) return;
    await this.transactions.run(async () => {
      await this.media.detach(current);
      await this.organizations.update(
        organizationId,
        slot === 'logo' ? { logoMediaId: null } : { coverMediaId: null },
        this.clock.now(),
      );
      await this.events.record(OrganizationUpdated, organizationId, { fields: [slot] });
    });
  }

  /**
   * Logical deletion: the page answers 404, its slug stays reserved, pending invitations are
   * revoked, its files detached and the contributor facets of its members unlinked.
   */
  async delete(organizationId: string, actorId: string): Promise<void> {
    const organization = await this.reads.require(organizationId);
    await this.transactions.run(async () => {
      const now = this.clock.now();
      await this.organizations.update(organizationId, { deletedAt: now }, now);
      for (const mediaId of [organization.logoMediaId, organization.coverMediaId]) {
        if (mediaId) await this.media.detach(mediaId);
      }
      await this.organizations.revokePendingInvitations(organizationId);
      for (const member of await this.organizations.members(organizationId)) {
        await this.profiles.unlinkOrganization(member.userId, organizationId);
      }
      await this.events.record(OrganizationDeleted, organizationId, { deletedBy: actorId });
    });
  }
}
