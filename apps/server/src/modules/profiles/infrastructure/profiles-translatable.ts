import { Injectable, type OnModuleInit } from '@nestjs/common';
import { LocalizationFacade } from '../../localization';
import { ProfilesFacade } from '../application/profiles.facade';
import { ProfileRepository } from '../application/ports';

/**
 * The headline and the presentation of a profile, by its handle, offered to the translation on
 * demand (§8.3); a member hidden from the reader (block) is absent.
 */
@Injectable()
export class ProfilesTranslatable implements OnModuleInit {
  constructor(
    private readonly localization: LocalizationFacade,
    private readonly profiles: ProfilesFacade,
    private readonly repository: ProfileRepository,
  ) {}

  onModuleInit(): void {
    this.localization.registerTranslatableSource({
      type: 'profile',
      read: async (handle, readerId) => {
        const userId = await this.profiles.userIdOf(handle, readerId);
        if (!userId) return null;
        const [profile] = await this.repository.findBaseProfiles([userId]);
        if (!profile) return null;
        const fields = Object.fromEntries(
          Object.entries({ headline: profile.headline, bio: profile.bio }).filter(
            (entry): entry is [string, string] => Boolean(entry[1]?.trim()),
          ),
        );
        return { key: userId, fields, language: null };
      },
    });
  }
}
