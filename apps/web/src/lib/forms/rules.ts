import type { z } from 'zod';

/**
 * Rules of a form the api checks as a whole (a code of the api, not a field error): checked in
 * the browser too, they put a precise message under their field (`web.forms.rules.<rule>`).
 */

/** The end of an event follows its start (`EVENTS_SCHEDULE_INVALID` of the api). */
export function endsAfterStart<Schema extends z.ZodType<{ startsAt?: string; endsAt?: string }>>(
  schema: Schema,
): Schema {
  return schema.superRefine((value, context) => {
    if (!value.startsAt || !value.endsAt) return;
    if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        input: value.endsAt,
        params: { rule: 'endsAfterStart' },
      });
    }
  });
}
