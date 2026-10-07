import { z } from 'zod';
import { countryCodeSchema, referenceCodeSchema } from './profiles.js';

/** Labels are i18n keys of the `reference` namespace: the api never returns localized text. */
const labelledCodeSchema = z.object({ code: z.string(), labelKey: z.string() });

export const countryReferenceSchema = z.object({
  code: countryCodeSchema,
  labelKey: z.string(),
  /** UN M49 codes; null for areas outside the M49 classification. */
  m49Region: z.string().nullable(),
  m49SubRegion: z.string().nullable(),
  m49IntermediateRegion: z.string().nullable(),
  /** Africa (002) or Caribbean (029): allowed as an entrepreneur company country. */
  eligibleForCompany: z.boolean(),
});

export const sectorReferenceSchema = z.object({
  code: referenceCodeSchema,
  labelKey: z.string(),
  /** ISIC Rev. 4 section letter (provisional taxonomy). */
  isicSection: z.string(),
});

export const stageReferenceSchema = z.object({ code: referenceCodeSchema, labelKey: z.string() });

export const referenceDataSchema = z.object({
  countries: z.array(countryReferenceSchema),
  sectors: z.array(sectorReferenceSchema),
  stages: z.array(stageReferenceSchema),
  intentions: z.array(labelledCodeSchema),
  contributorHats: z.array(labelledCodeSchema),
  structureTypes: z.array(labelledCodeSchema),
  fundingInstruments: z.array(labelledCodeSchema),
  patronageTypes: z.array(labelledCodeSchema),
  entrepreneurNeeds: z.array(labelledCodeSchema.extend({ matchingHats: z.array(z.string()) })),
});

export type CountryReference = z.infer<typeof countryReferenceSchema>;
export type SectorReference = z.infer<typeof sectorReferenceSchema>;
export type StageReference = z.infer<typeof stageReferenceSchema>;
export type ReferenceData = z.infer<typeof referenceDataSchema>;
