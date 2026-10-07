import type {
  ContributorFacet,
  EntrepreneurFacet,
  Intention,
  ProfileLinks,
  ProfileVisibility,
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

/** Privacy by default (GDPR article 25): no public page, business details for members only. */
export const DEFAULT_VISIBILITY: ProfileVisibility = {
  publicPageEnabled: false,
  entrepreneurDetails: 'members',
  contributorDetails: 'members',
  networkLists: 'members',
};
