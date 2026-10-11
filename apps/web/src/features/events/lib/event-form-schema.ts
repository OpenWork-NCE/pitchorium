import {
  createEventRequestSchema,
  EVENT_CAPACITY_MAX,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_IMAGE_ALT_MAX_LENGTH,
  EVENT_LOCATION_MAX_LENGTH,
  EVENT_SECTORS_MAX,
  eventFormatSchema,
  eventVisibilitySchema,
  languageCodeSchema,
} from '@pitchorium/contracts';
import { z } from 'zod';
import { endsAfterStart } from '@/lib/forms/rules';

/**
 * The schema of the form, in its own module: static imports of Zod and of the contracts, that
 * the bundler follows to keep only what it uses; loaded on demand by `schemas.ts` (ADR 0094).
 */
function build() {
  const fields = createEventRequestSchema.shape;
  const text = (max: number) => z.string().trim().max(max).optional();
  return endsAfterStart(
    z.object({
      title: fields.title,
      description: z.string().max(EVENT_DESCRIPTION_MAX_LENGTH).optional(),
      format: eventFormatSchema,
      startsAt: z.iso.datetime({ offset: true }),
      endsAt: z.iso.datetime({ offset: true }),
      timeZone: fields.timeZone,
      location: z.object({
        name: text(EVENT_LOCATION_MAX_LENGTH),
        address: text(EVENT_LOCATION_MAX_LENGTH),
        city: text(100),
        countryCode: z.string().optional(),
      }),
      onlineUrl: z.string().trim().max(2048).optional(),
      language: languageCodeSchema,
      sectorCodes: z.array(z.string()).max(EVENT_SECTORS_MAX).optional(),
      capacity: z
        .string()
        .trim()
        .regex(/^\d*$/)
        .refine((value) => !value || Number(value) <= EVENT_CAPACITY_MAX)
        .optional(),
      visibility: eventVisibilitySchema,
      imageMediaId: z.string().nullable(),
      imageAlt: text(EVENT_IMAGE_ALT_MAX_LENGTH),
      organization: z.string().optional(),
      project: z.string().optional(),
    }),
  );
}

export const eventFormSchema = build();
