import type { z } from 'zod';

/**
 * Schema of the form of an event, loaded with Zod once the page is idle or at the first check
 * (ADR 0094). It checks the shape and the bounds of each field from the contracts; what a type of
 * event requires (a place, a link) and the audience allowed are decided by the api, whose refusal
 * goes under its field (ADR 0113).
 */
export const eventFormSchema = () =>
  Promise.all([import('@pitchorium/contracts'), import('zod'), import('@/lib/forms/rules')]).then(
    ([contracts, { z }, { endsAfterStart }]) => {
      const fields = contracts.createEventRequestSchema.shape;
      const text = (max: number) => z.string().trim().max(max).optional();
      return endsAfterStart(
        z.object({
          title: fields.title,
          description: z.string().max(contracts.EVENT_DESCRIPTION_MAX_LENGTH).optional(),
          format: contracts.eventFormatSchema,
          startsAt: z.iso.datetime({ offset: true }),
          endsAt: z.iso.datetime({ offset: true }),
          timeZone: fields.timeZone,
          location: z.object({
            name: text(contracts.EVENT_LOCATION_MAX_LENGTH),
            address: text(contracts.EVENT_LOCATION_MAX_LENGTH),
            city: text(100),
            countryCode: z.string().optional(),
          }),
          onlineUrl: z.string().trim().max(2048).optional(),
          language: contracts.languageCodeSchema,
          sectorCodes: z.array(z.string()).max(contracts.EVENT_SECTORS_MAX).optional(),
          capacity: z
            .string()
            .trim()
            .regex(/^\d*$/)
            .refine((value) => !value || Number(value) <= contracts.EVENT_CAPACITY_MAX)
            .optional(),
          visibility: contracts.eventVisibilitySchema,
          imageMediaId: z.string().nullable(),
          imageAlt: text(contracts.EVENT_IMAGE_ALT_MAX_LENGTH),
          organization: z.string().optional(),
          project: z.string().optional(),
        }),
      );
    },
  );

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

export type EventFormSchema = z.ZodType<EventFormValues>;
