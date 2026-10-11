import {
  MISSION_COUNTRIES_MAX,
  MISSION_DESCRIPTION_MAX_LENGTH,
  MISSION_DOMAIN_MAX_LENGTH,
  MISSION_LANGUAGES_MAX,
  MISSION_SECTORS_MAX,
  MISSION_TITLE_MAX_LENGTH,
  missionDirectionSchema,
  missionFormatSchema,
  missionModeSchema,
  missionVisibilitySchema,
  timeEntryKindSchema,
} from '@pitchorium/contracts';
import { z } from 'zod';

/**
 * The schema of the form, in its own module: static imports of Zod and of the contracts, that
 * the bundler follows to keep only what it uses; loaded on demand by `schemas.ts` (ADR 0094).
 */
function build() {
  return z.object({
    direction: missionDirectionSchema,
    title: z.string().trim().min(1).max(MISSION_TITLE_MAX_LENGTH),
    description: z.string().trim().min(1).max(MISSION_DESCRIPTION_MAX_LENGTH),
    kind: timeEntryKindSchema,
    domain: z.string().trim().min(1).max(MISSION_DOMAIN_MAX_LENGTH),
    sectorCodes: z.array(z.string()).max(MISSION_SECTORS_MAX).optional(),
    format: missionFormatSchema,
    estimatedHours: z
      .string()
      .trim()
      .regex(/^[1-9]\d{0,2}$/),
    mode: missionModeSchema,
    countryCodes: z.array(z.string()).max(MISSION_COUNTRIES_MAX).optional(),
    languages: z.array(z.string()).min(1).max(MISSION_LANGUAGES_MAX),
    capacity: z
      .string()
      .trim()
      .regex(/^\d{0,2}$/)
      .optional(),
    skills: z.string().max(700).optional(),
    desiredBy: z.string().optional(),
    visibility: missionVisibilitySchema,
    project: z.string().optional(),
  });
}

export const missionFormSchema = build();
