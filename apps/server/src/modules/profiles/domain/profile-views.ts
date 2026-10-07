import type {
  OwnProfile,
  ProfileStrength,
  ProfileSummary,
  ProfileView,
  VisibilityLevel,
} from '@pitchorium/contracts';
import type { Profile } from './profile';

export type Audience = 'owner' | 'member' | 'public';

function canSee(level: VisibilityLevel, audience: Audience): boolean {
  return (
    audience === 'owner' || level === 'public' || (level === 'members' && audience === 'member')
  );
}

/** Profile as seen by `audience`; each group of business details follows its own setting. */
export function profileView(profile: Profile, audience: Audience): ProfileView {
  const { base, entrepreneur, contributor } = profile;
  return {
    handle: base.handle,
    displayName: base.displayName,
    headline: base.headline,
    bio: base.bio,
    countryCode: base.countryCode,
    city: base.city,
    languages: base.languages,
    links: base.links,
    avatarUrl: base.avatarUrl,
    avatarMediaId: base.avatarMediaId,
    coverMediaId: base.coverMediaId,
    facets: { entrepreneur: entrepreneur !== null, contributor: contributor !== null },
    entrepreneur:
      entrepreneur && canSee(base.visibility.entrepreneurDetails, audience) ? entrepreneur : null,
    contributor:
      contributor && canSee(base.visibility.contributorDetails, audience) ? contributor : null,
  };
}

/** Null when the owner has not enabled the public page: the profile must not be found. */
export function publicProfileView(profile: Profile): ProfileView | null {
  return profile.base.visibility.publicPageEnabled ? profileView(profile, 'public') : null;
}

export function ownProfileView(profile: Profile, strength: ProfileStrength): OwnProfile {
  return {
    ...profileView(profile, 'owner'),
    userId: profile.base.userId,
    intention: profile.base.intention,
    visibility: profile.base.visibility,
    strength,
    createdAt: profile.base.createdAt.toISOString(),
    updatedAt: profile.base.updatedAt.toISOString(),
  };
}

export function profileSummary(profile: Profile): ProfileSummary {
  return {
    handle: profile.base.handle,
    displayName: profile.base.displayName,
    headline: profile.base.headline,
    avatarUrl: profile.base.avatarUrl,
    intention: profile.base.intention,
    facets: {
      entrepreneur: profile.entrepreneur !== null,
      contributor: profile.contributor !== null,
    },
    publicPageEnabled: profile.base.visibility.publicPageEnabled,
  };
}
