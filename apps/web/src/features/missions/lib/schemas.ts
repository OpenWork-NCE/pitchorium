/**
 * Schema of the form of a mission, loaded with Zod once the page is idle or at the first check
 * (ADR 0094): the shape and the bounds of the fields, from the contracts. The volunteer nature
 * (no vocabulary of job offer, hours of the format) is decided by the api, whose refusal goes
 * under its field (ADR 0071).
 */
export const missionFormSchema = () =>
  Promise.all([import('@pitchorium/contracts'), import('zod')]).then(([contracts, { z }]) =>
    z.object({
      direction: contracts.missionDirectionSchema,
      title: z.string().trim().min(1).max(contracts.MISSION_TITLE_MAX_LENGTH),
      description: z.string().trim().min(1).max(contracts.MISSION_DESCRIPTION_MAX_LENGTH),
      kind: contracts.timeEntryKindSchema,
      domain: z.string().trim().min(1).max(contracts.MISSION_DOMAIN_MAX_LENGTH),
      sectorCodes: z.array(z.string()).max(contracts.MISSION_SECTORS_MAX).optional(),
      format: contracts.missionFormatSchema,
      estimatedHours: z
        .string()
        .trim()
        .regex(/^[1-9]\d{0,2}$/),
      mode: contracts.missionModeSchema,
      countryCodes: z.array(z.string()).max(contracts.MISSION_COUNTRIES_MAX).optional(),
      languages: z.array(z.string()).min(1).max(contracts.MISSION_LANGUAGES_MAX),
      capacity: z
        .string()
        .trim()
        .regex(/^\d{0,2}$/)
        .optional(),
      skills: z.string().max(700).optional(),
      desiredBy: z.string().optional(),
      visibility: contracts.missionVisibilitySchema,
      project: z.string().optional(),
    }),
  );

/** The values of the form of a mission. */
export interface MissionFormValues {
  direction: 'offer' | 'request';
  title: string;
  description: string;
  kind: 'mentoring' | 'expertise';
  domain: string;
  sectorCodes?: string[] | undefined;
  format: 'session' | 'short_mission';
  estimatedHours: string;
  mode: 'remote' | 'on_site';
  countryCodes?: string[] | undefined;
  languages: string[];
  capacity?: string | undefined;
  skills?: string | undefined;
  desiredBy?: string | undefined;
  visibility: 'members' | 'public';
  project?: string | undefined;
}
