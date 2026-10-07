import { Injectable } from '@nestjs/common';
import { MediaFacade } from '../../media';
import type { Profile } from '../domain/profile';
import type { ProfileImages } from '../domain/profile-views';

/** Display URLs of a profile: uploaded files through media, else the provider photo. */
@Injectable()
export class ProfileImagesService {
  constructor(private readonly media: MediaFacade) {}

  async resolve(profile: Profile): Promise<ProfileImages> {
    const { avatarMediaId, coverMediaId, avatarUrl } = profile.base;
    const images = await this.media.images([avatarMediaId, coverMediaId]);
    return {
      // A file not ready or removed by moderation falls back to the provider photo.
      avatarUrl: (avatarMediaId ? images.get(avatarMediaId)?.url : undefined) ?? avatarUrl,
      coverUrl: (coverMediaId ? images.get(coverMediaId)?.url : undefined) ?? null,
    };
  }
}
