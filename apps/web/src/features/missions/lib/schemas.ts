/**
 * Schema of the form of a mission, loaded with Zod once the page is idle or at the first check
 * (ADR 0094): the shape and the bounds of the fields, from the contracts. The volunteer nature
 * (no vocabulary of job offer, hours of the format) is decided by the api, whose refusal goes
 * under its field (ADR 0071).
 */
export const missionFormSchema = () =>
  import('./mission-form-schema').then((module) => module.missionFormSchema);

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
