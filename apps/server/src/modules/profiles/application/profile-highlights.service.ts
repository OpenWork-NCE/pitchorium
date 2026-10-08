import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../platform/audit';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError } from '../../../platform/kernel';
import { ProfileUpdated } from '../domain/profile-events';
import { ProfileEventsRecorder } from './profile-events.recorder';
import { ProfileRepository } from './ports';

/**
 * Editorial highlight of a profile by a moderator or an administrator, through the
 * administration; only a profile with its public page can be featured.
 */
@Injectable()
export class ProfileHighlightsService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly events: ProfileEventsRecorder,
    private readonly audit: AuditService,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async setFeatured(handle: string, actorId: string, featured: boolean): Promise<void> {
    const resolved = await this.profiles.resolveHandle(handle);
    const [profile] = resolved ? await this.profiles.findBaseProfiles([resolved.userId]) : [];
    if (!profile || (featured && !profile.visibility.publicPageEnabled)) {
      throw new DomainError('PROFILES_PROFILE_NOT_FOUND', 'Public profile not found');
    }
    const now = this.clock.now();
    await this.transactions.run(async () => {
      await this.profiles.setFeatured(
        profile.userId,
        featured ? actorId : null,
        featured ? now : null,
      );
      await this.events.record(ProfileUpdated, profile.userId, { fields: ['featured'] });
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: featured ? 'profiles.profile-featured' : 'profiles.profile-unfeatured',
        target: { type: 'profile', id: profile.userId },
      });
    });
  }

  featured(limit: number): Promise<{ handle: string; featuredAt: Date | null }[]> {
    return this.profiles.featuredProfiles(limit);
  }
}
