import { Injectable } from '@nestjs/common';
import { ImpactFacade } from '../../impact';
import { MediaFacade } from '../../media';
import type { Profile } from '../domain/profile';
import type { ProfileDisplay } from '../domain/profile-views';
import { OrganizationDirectoryRegistry } from './organization-directory.registry';

/**
 * Data of a profile view owned by other modules: uploaded photo and cover through media (else
 * the provider photo), organization linked to the contributor facet, current impact assessment
 * of the entrepreneur facet (impact).
 */
@Injectable()
export class ProfileDisplayService {
  constructor(
    private readonly media: MediaFacade,
    private readonly organizations: OrganizationDirectoryRegistry,
    private readonly impact: ImpactFacade,
  ) {}

  async resolve(profile: Profile): Promise<ProfileDisplay> {
    const { avatarMediaId, coverMediaId, avatarUrl } = profile.base;
    const organizationId = profile.contributor?.organizationId ?? null;
    const [images, organizations, entrepreneurImpact] = await Promise.all([
      this.media.images([avatarMediaId, coverMediaId]),
      this.organizations.summaries(organizationId ? [organizationId] : []),
      profile.entrepreneur
        ? this.impact.current({ type: 'entrepreneur_facet', id: profile.base.userId })
        : Promise.resolve(null),
    ]);
    return {
      // A file not ready or removed by moderation falls back to the provider photo.
      avatarUrl: (avatarMediaId ? images.get(avatarMediaId)?.url : undefined) ?? avatarUrl,
      coverUrl: (coverMediaId ? images.get(coverMediaId)?.url : undefined) ?? null,
      contributorOrganization: organizationId ? (organizations.get(organizationId) ?? null) : null,
      entrepreneurImpact,
    };
  }
}
