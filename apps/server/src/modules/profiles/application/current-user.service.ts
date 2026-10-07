import { Injectable } from '@nestjs/common';
import type { CurrentUser } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import { AccessFacade } from '../../access';
import { IdentityFacade } from '../../identity';
import { profileStrength } from '../domain/profile-strength';
import { profileSummary } from '../domain/profile-views';
import { ProfilesService } from './profiles.service';

/** GET /v1/me: identity, access and profile of the signed-in member in one answer. */
@Injectable()
export class CurrentUserService {
  constructor(
    private readonly identity: IdentityFacade,
    private readonly access: AccessFacade,
    private readonly profiles: ProfilesService,
  ) {}

  async get(userId: string): Promise<CurrentUser> {
    const user = await this.identity.findUser(userId);
    if (!user) throw new DomainError('IDENTITY_USER_NOT_FOUND', 'User not found');
    const [profile, roles, trust, activeLocales] = await Promise.all([
      this.profiles.ensureProfile(userId),
      this.access.rolesOf(userId),
      this.access.trustLevels(userId, user.emailVerified),
      this.identity.activeLocales(),
    ]);
    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.image,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISOString(),
      },
      preferences: { locale: user.locale },
      activeLocales,
      legal: this.identity.legalStatus(user),
      roles,
      trust,
      profile: profileSummary(profile),
      profileStrength: profileStrength(profile),
    };
  }
}
