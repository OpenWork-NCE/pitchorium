import { z } from 'zod';

export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 100;

export const cursorPageQuerySchema = z.object({
  /** Opaque cursor returned by the previous page. */
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});

export function cursorPageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    /** Null when there is no further page. */
    nextCursor: z.string().nullable(),
  });
}

export type CursorPageQuery = z.infer<typeof cursorPageQuerySchema>;
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
