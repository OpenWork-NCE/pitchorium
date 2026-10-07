import type {
  ContributorFacet,
  EntrepreneurFacet,
  Intention,
  ProfileLinks,
  ProfileVisibility,
} from '@pitchorium/contracts';
import type { CountryRegions } from '../domain/facet-rules';
import type { BaseProfile, Profile } from '../domain/profile';

export type ProfileImageSlot = 'avatar' | 'cover';

export interface BaseProfilePatch {
  displayName?: string;
  headline?: string | null;
  bio?: string | null;
  countryCode?: string | null;
  city?: string | null;
  languages?: string[];
  links?: ProfileLinks;
}

export abstract class ProfileRepository {
  abstract findByUserId(userId: string): Promise<Profile | null>;
  /** Current handle first, then former handles (for redirects). */
  abstract resolveHandle(handle: string): Promise<{ userId: string; current: boolean } | null>;
  /** True when the handle is current for another member or was ever used by one. */
  abstract isHandleUnavailable(handle: string, forUserId: string): Promise<boolean>;
  /** Insert unless a profile exists for this user; false when nothing was inserted. */
  abstract insertIfAbsent(profile: BaseProfile): Promise<boolean>;
  abstract updateBase(userId: string, patch: BaseProfilePatch, now: Date): Promise<void>;
  abstract setIntention(userId: string, intention: Intention | null, now: Date): Promise<void>;
  abstract setVisibility(userId: string, visibility: ProfileVisibility, now: Date): Promise<void>;
  abstract setImage(
    userId: string,
    slot: ProfileImageSlot,
    mediaId: string | null,
    now: Date,
  ): Promise<void>;
  abstract changeHandle(userId: string, previous: string, next: string, now: Date): Promise<void>;
  abstract saveEntrepreneurFacet(
    userId: string,
    facet: EntrepreneurFacet,
    now: Date,
  ): Promise<void>;
  abstract deleteEntrepreneurFacet(userId: string): Promise<boolean>;
  abstract saveContributorFacet(userId: string, facet: ContributorFacet, now: Date): Promise<void>;
  abstract deleteContributorFacet(userId: string): Promise<boolean>;
}

export interface CountryReferenceRow extends CountryRegions {
  m49SubRegion: string | null;
}

export interface ReferenceData {
  countries: CountryReferenceRow[];
  sectors: { code: string; isicSection: string }[];
  stages: { code: string }[];
}

export abstract class ReferenceDataRepository {
  abstract load(): Promise<ReferenceData>;
}
