import { Injectable } from '@nestjs/common';
import {
  CONTRIBUTOR_HATS,
  ENTREPRENEUR_NEEDS,
  FUNDING_INSTRUMENTS,
  INTENTIONS,
  NEED_TO_HATS,
  PATRONAGE_TYPES,
  type ReferenceData as ReferenceDataDto,
  STRUCTURE_TYPES,
} from '@pitchorium/contracts';
import { Clock, DomainError } from '../../../platform/kernel';
import { type CountryRegions, isEligibleCompanyCountry } from '../domain/facet-rules';
import { type ReferenceData, ReferenceDataRepository } from './ports';

const CACHE_TTL_MS = 10 * 60_000;

const labelled = (namespace: string, codes: readonly string[]) =>
  codes.map((code) => ({ code, labelKey: `${namespace}.${code}` }));

/** Reference data changes only with a deployment (seed): cached in memory for 10 minutes. */
@Injectable()
export class ReferenceDataService {
  private cache: { data: ReferenceData; expiresAt: number } | undefined;

  constructor(
    private readonly repository: ReferenceDataRepository,
    private readonly clock: Clock,
  ) {}

  private async data(): Promise<ReferenceData> {
    const now = this.clock.now().getTime();
    if (!this.cache || this.cache.expiresAt <= now) {
      this.cache = { data: await this.repository.load(), expiresAt: now + CACHE_TTL_MS };
    }
    return this.cache.data;
  }

  async all(): Promise<ReferenceDataDto> {
    const data = await this.data();
    return {
      countries: data.countries.map((country) => ({
        code: country.code,
        labelKey: `countries.${country.code}`,
        m49Region: country.m49Region,
        m49SubRegion: country.m49SubRegion,
        m49IntermediateRegion: country.m49IntermediateRegion,
        eligibleForCompany: isEligibleCompanyCountry(country),
      })),
      sectors: data.sectors.map((sector) => ({
        code: sector.code,
        labelKey: `sectors.${sector.code}`,
        isicSection: sector.isicSection,
      })),
      stages: data.stages.map((stage) => ({ code: stage.code, labelKey: `stages.${stage.code}` })),
      intentions: labelled('intentions', INTENTIONS),
      contributorHats: labelled('contributorHats', CONTRIBUTOR_HATS),
      structureTypes: labelled('structureTypes', STRUCTURE_TYPES),
      fundingInstruments: labelled('fundingInstruments', FUNDING_INSTRUMENTS),
      patronageTypes: labelled('patronageTypes', PATRONAGE_TYPES),
      entrepreneurNeeds: ENTREPRENEUR_NEEDS.map((code) => ({
        code,
        labelKey: `entrepreneurNeeds.${code}`,
        matchingHats: [...NEED_TO_HATS[code]],
      })),
    };
  }

  async country(code: string): Promise<CountryRegions> {
    const country = (await this.data()).countries.find((candidate) => candidate.code === code);
    if (!country) throw new DomainError('PROFILES_UNKNOWN_REFERENCE', `Unknown country ${code}`);
    return country;
  }

  async assertCountries(codes: readonly string[]): Promise<void> {
    for (const code of codes) await this.country(code);
  }

  async assertSectors(codes: readonly string[]): Promise<void> {
    const known = new Set((await this.data()).sectors.map((sector) => sector.code));
    const unknown = codes.find((code) => !known.has(code));
    if (unknown) throw new DomainError('PROFILES_UNKNOWN_REFERENCE', `Unknown sector ${unknown}`);
  }

  async assertStage(code: string): Promise<void> {
    if (!(await this.data()).stages.some((stage) => stage.code === code)) {
      throw new DomainError('PROFILES_UNKNOWN_REFERENCE', `Unknown stage ${code}`);
    }
  }
}
