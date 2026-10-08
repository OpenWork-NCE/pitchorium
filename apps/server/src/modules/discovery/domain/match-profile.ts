import type { ContributorHat, EntrepreneurNeed, VisibilityLevel } from '@pitchorium/contracts';
import type { PersonProfile } from './matching';
import type { PersonSource } from './search-documents';

/** Matching attributes of a member, as stored by the projection. */
export interface MatchProfileRecord {
  userId: string;
  displayName: string;
  residenceCountry: string | null;
  languages: string[];
  hasEntrepreneur: boolean;
  entrepreneurVisibility: VisibilityLevel;
  companyCountry: string | null;
  entrepreneurSector: string | null;
  needs: string[];
  fundingTargetMinor: bigint | null;
  fundingTargetCurrency: string | null;
  hasContributor: boolean;
  contributorVisibility: VisibilityLevel;
  hats: string[];
  interventionCountries: string[];
  contributorSectors: string[];
  ticketMinMinor: bigint | null;
  ticketMaxMinor: bigint | null;
  ticketCurrency: string | null;
  instruments: string[];
  mentoringAvailable: boolean;
}

export function matchProfileOf(source: PersonSource): MatchProfileRecord {
  const e = source.entrepreneur;
  const c = source.contributor;
  return {
    userId: source.userId,
    displayName: source.displayName,
    residenceCountry: source.countryCode,
    languages: source.languages,
    hasEntrepreneur: e !== null,
    entrepreneurVisibility: source.entrepreneurVisibility,
    companyCountry: e?.companyCountryCode ?? null,
    entrepreneurSector: e?.sectorCode ?? null,
    needs: e?.needs ?? [],
    fundingTargetMinor: e?.fundingTarget?.amountMinor ?? null,
    fundingTargetCurrency: e?.fundingTarget?.currency ?? null,
    hasContributor: c !== null,
    contributorVisibility: source.contributorVisibility,
    hats: c?.hats ?? [],
    interventionCountries: c?.interventionCountryCodes ?? [],
    contributorSectors: c?.sectorCodes ?? [],
    ticketMinMinor: c?.ticket?.minMinor ?? null,
    ticketMaxMinor: c?.ticket?.maxMinor ?? null,
    ticketCurrency: c?.ticket?.currency ?? null,
    instruments: c?.acceptedInstruments ?? [],
    mentoringAvailable: c?.mentoringAvailable ?? false,
  };
}

/**
 * The member as matching sees them. As a candidate (`forOthers`), a facet whose details are
 * private is left out: the reasons would reveal it. For their own suggestions, everything.
 */
export function personProfileOf(record: MatchProfileRecord, forOthers: boolean): PersonProfile {
  const visible = (level: VisibilityLevel) => !forOthers || level !== 'private';
  const entrepreneur =
    record.hasEntrepreneur &&
    visible(record.entrepreneurVisibility) &&
    record.companyCountry !== null &&
    record.entrepreneurSector !== null
      ? {
          sector: record.entrepreneurSector,
          companyCountry: record.companyCountry,
          needs: record.needs as EntrepreneurNeed[],
          fundingTarget:
            record.fundingTargetMinor !== null && record.fundingTargetCurrency !== null
              ? { minor: record.fundingTargetMinor, currency: record.fundingTargetCurrency }
              : null,
        }
      : null;
  const contributor =
    record.hasContributor && visible(record.contributorVisibility)
      ? {
          hats: record.hats as ContributorHat[],
          interventionCountries: record.interventionCountries,
          sectors: record.contributorSectors,
          ticket:
            record.ticketMinMinor !== null &&
            record.ticketMaxMinor !== null &&
            record.ticketCurrency !== null
              ? {
                  min: record.ticketMinMinor,
                  max: record.ticketMaxMinor,
                  currency: record.ticketCurrency,
                }
              : null,
          instruments: record.instruments,
          mentoringAvailable: record.mentoringAvailable,
        }
      : null;
  return {
    userId: record.userId,
    name: record.displayName,
    residenceCountry: record.residenceCountry,
    languages: record.languages,
    entrepreneur,
    contributor,
  };
}
