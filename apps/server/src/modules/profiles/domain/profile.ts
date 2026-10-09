import {
  type ContributorFacet,
  type EntrepreneurFacet,
  type Intention,
  minimumProfileSchema,
  type ProfileLinks,
  type ProfileVisibility,
} from '@pitchorium/contracts';

export interface BaseProfile {
  userId: string;
  handle: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  countryCode: string | null;
  city: string | null;
  languages: string[];
  links: ProfileLinks;
  avatarUrl: string | null;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  intention: Intention | null;
  visibility: ProfileVisibility;
  createdAt: Date;
  updatedAt: Date;
}

/** A base profile and its two optional facets, which may coexist. */
export interface Profile {
  base: BaseProfile;
  entrepreneur: EntrepreneurFacet | null;
  contributor: ContributorFacet | null;
}

/**
 * Minimum profile (§7.2, step 3): a name, a title and a country, what another member needs to
 * know who reaches them (`minimumProfileSchema` of the contracts). Asked before a connection
 * request or a first message out of network; provisional (docs/open-questions.md, ADR 0109).
 */
export function hasMinimumProfile(
  base: Pick<BaseProfile, 'displayName' | 'headline' | 'countryCode'>,
): boolean {
  return minimumProfileSchema.safeParse({
    displayName: base.displayName,
    headline: base.headline,
    countryCode: base.countryCode,
  }).success;
}

/** Privacy by default (GDPR article 25): no public page, business details for members only. */
export const DEFAULT_VISIBILITY: ProfileVisibility = {
  publicPageEnabled: false,
  entrepreneurDetails: 'members',
  contributorDetails: 'members',
  networkLists: 'members',
};
