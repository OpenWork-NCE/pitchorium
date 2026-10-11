/**
 * Schema of the form of an event, loaded with Zod once the page is idle or at the first check
 * (ADR 0094). It checks the shape and the bounds of each field from the contracts; what a type of
 * event requires (a place, a link) and the audience allowed are decided by the api, whose refusal
 * goes under its field (ADR 0113).
 */
export const eventFormSchema = () =>
  import('./event-form-schema').then((module) => module.eventFormSchema);

/** The values of the form of an event. */
export interface EventFormValues {
  title: string;
  description?: string | undefined;
  format: 'online' | 'in_person' | 'hybrid';
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location: {
    name?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    countryCode?: string | undefined;
  };
  onlineUrl?: string | undefined;
  language: string;
  sectorCodes?: string[] | undefined;
  capacity?: string | undefined;
  visibility: 'members' | 'public';
  imageMediaId: string | null;
  imageAlt?: string | undefined;
  organization?: string | undefined;
  project?: string | undefined;
}
