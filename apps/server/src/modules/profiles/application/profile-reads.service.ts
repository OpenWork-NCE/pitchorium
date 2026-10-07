import { Injectable } from '@nestjs/common';
import type { OwnProfile, ProfileView } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import { profileStrength } from '../domain/profile-strength';
import { ownProfileView, profileView, publicProfileView } from '../domain/profile-views';
import { ProfileImagesService } from './profile-images.service';
import { ProfileRepository } from './ports';
import { ProfilesService } from './profiles.service';

export type ProfileLookup =
  { kind: 'found'; view: ProfileView } | { kind: 'moved'; handle: string };

const notFound = () => new DomainError('PROFILES_PROFILE_NOT_FOUND', 'Profile not found');

/** Read side of profiles, with privacy applied to the audience. */
@Injectable()
export class ProfileReadsService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly writer: ProfilesService,
    private readonly images: ProfileImagesService,
  ) {}

  async own(userId: string): Promise<OwnProfile> {
    const profile = await this.writer.ensureProfile(userId);
    return ownProfileView(profile, profileStrength(profile), await this.images.resolve(profile));
  }

  /** Member view; a former handle answers with the current one (redirect). */
  async forMember(handle: string, viewerId: string): Promise<ProfileLookup> {
    const resolved = await this.profiles.resolveHandle(handle);
    if (!resolved) throw notFound();
    const profile = await this.profiles.findByUserId(resolved.userId);
    if (!profile) throw notFound();
    if (!resolved.current) return { kind: 'moved', handle: profile.base.handle };
    const audience = resolved.userId === viewerId ? 'owner' : 'member';
    return {
      kind: 'found',
      view: profileView(profile, audience, await this.images.resolve(profile)),
    };
  }

  /**
   * Anonymous view. A profile without a public page answers 404, including through a former
   * handle, so that neither its existence nor its new handle leaks.
   */
  async forPublic(handle: string): Promise<ProfileLookup> {
    const resolved = await this.profiles.resolveHandle(handle);
    const profile = resolved ? await this.profiles.findByUserId(resolved.userId) : null;
    const view = profile ? publicProfileView(profile, await this.images.resolve(profile)) : null;
    if (!resolved || !profile || !view) throw notFound();
    return resolved.current
      ? { kind: 'found', view }
      : { kind: 'moved', handle: profile.base.handle };
  }
}
