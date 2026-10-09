import type {
  ImpactAssessment,
  OwnProfile,
  ProfileStrength,
  ProfileSummary,
  ProfileView,
  VisibilityLevel,
} from '@pitchorium/contracts';
import type { Profile } from './profile';

export type Audience = 'owner' | 'member' | 'public';

export interface LinkedOrganization {
  id: string;
  slug: string;
  name: string;
  verified: boolean;
}

/**
 * Data resolved by other modules: display URLs (media, fallback: the provider photo), the
 * organization linked to the contributor facet and the impact assessment of the entrepreneur
 * facet.
 */
export interface ProfileDisplay {
  avatarUrl: string | null;
  coverUrl: string | null;
  contributorOrganization: LinkedOrganization | null;
  entrepreneurImpact: ImpactAssessment | null;
}

/** Without other modules: only the provider photo can be shown. */
export const minimalDisplay = (profile: Profile): ProfileDisplay => ({
  avatarUrl: profile.base.avatarUrl,
  coverUrl: null,
  contributorOrganization: null,
  entrepreneurImpact: null,
});

function canSee(level: VisibilityLevel, audience: Audience): boolean {
  return (
    audience === 'owner' || level === 'public' || (level === 'members' && audience === 'member')
  );
}

/** Profile as seen by `audience`; each group of business details follows its own setting. */
export function profileView(
  profile: Profile,
  audience: Audience,
  display: ProfileDisplay = minimalDisplay(profile),
): ProfileView {
  const { base, entrepreneur, contributor } = profile;
  const contributorVisible =
    contributor !== null && canSee(base.visibility.contributorDetails, audience);
  const entrepreneurVisible =
    entrepreneur !== null && canSee(base.visibility.entrepreneurDetails, audience);
  return {
    handle: base.handle,
    displayName: base.displayName,
    headline: base.headline,
    bio: base.bio,
    countryCode: base.countryCode,
    city: base.city,
    languages: base.languages,
    links: base.links,
    avatarUrl: display.avatarUrl,
    avatarMediaId: base.avatarMediaId,
    coverUrl: display.coverUrl,
    coverMediaId: base.coverMediaId,
    facets: { entrepreneur: entrepreneur !== null, contributor: contributor !== null },
    entrepreneur: entrepreneurVisible ? entrepreneur : null,
    entrepreneurImpact: entrepreneurVisible ? display.entrepreneurImpact : null,
    contributor: contributorVisible ? contributor : null,
    contributorOrganization: contributorVisible ? display.contributorOrganization : null,
  };
}

/** Null when the owner has not enabled the public page: the profile must not be found. */
export function publicProfileView(profile: Profile, display?: ProfileDisplay): ProfileView | null {
  return profile.base.visibility.publicPageEnabled ? profileView(profile, 'public', display) : null;
}

export function ownProfileView(
  profile: Profile,
  strength: ProfileStrength,
  display?: ProfileDisplay,
): OwnProfile {
  return {
    ...profileView(profile, 'owner', display),
    userId: profile.base.userId,
    intention: profile.base.intention,
    visibility: profile.base.visibility,
    strength,
    createdAt: profile.base.createdAt.toISOString(),
    updatedAt: profile.base.updatedAt.toISOString(),
  };
}

export function profileSummary(
  profile: Profile,
  display: ProfileDisplay = minimalDisplay(profile),
): ProfileSummary {
  return {
    handle: profile.base.handle,
    displayName: profile.base.displayName,
    headline: profile.base.headline,
    avatarUrl: display.avatarUrl,
    intention: profile.base.intention,
    facets: {
      entrepreneur: profile.entrepreneur !== null,
      contributor: profile.contributor !== null,
    },
    publicPageEnabled: profile.base.visibility.publicPageEnabled,
  };
}
