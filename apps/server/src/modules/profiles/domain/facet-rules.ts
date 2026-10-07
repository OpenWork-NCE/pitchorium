import type { ContributorFacet, TicketRange } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

/** UN M49 codes of the regions where a company may be based (cahier des charges 2.1). */
export const AFRICA_M49 = '002';
export const CARIBBEAN_M49 = '029';

export interface CountryRegions {
  code: string;
  m49Region: string | null;
  m49IntermediateRegion: string | null;
}

export function isEligibleCompanyCountry(country: CountryRegions): boolean {
  return country.m49Region === AFRICA_M49 || country.m49IntermediateRegion === CARIBBEAN_M49;
}

/** The company must be in Africa or the Caribbean; its founder may live anywhere. */
export function assertEligibleCompanyCountry(country: CountryRegions): void {
  if (!isEligibleCompanyCountry(country)) {
    throw new DomainError(
      'PROFILES_COMPANY_COUNTRY_NOT_ELIGIBLE',
      `Country ${country.code} is neither in Africa (002) nor in the Caribbean (029)`,
    );
  }
}

export function assertTicketRange(ticket: TicketRange | null): void {
  if (ticket && BigInt(ticket.minAmountMinor) > BigInt(ticket.maxAmountMinor)) {
    throw new DomainError('PROFILES_TICKET_RANGE_INVALID', 'Minimum ticket exceeds maximum');
  }
}

/** A contributor facet exists only with at least one hat. */
export function assertContributorFacet(facet: ContributorFacet): void {
  if (facet.hats.length === 0) {
    throw new DomainError('PROFILES_CONTRIBUTOR_HAT_REQUIRED', 'At least one hat is required');
  }
  assertTicketRange(facet.ticket);
}
