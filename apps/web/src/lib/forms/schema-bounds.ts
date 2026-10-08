import type { z } from 'zod';
import type { IssueLike } from './issues';

/** The internals of a Zod 4 schema these functions read (zod/v4/core `$ZodType._zod.def`). */
interface Definition {
  type: string;
  /** Format of a string schema (`z.url()`, `z.email()`). */
  format?: string;
  shape?: Record<string, z.ZodType>;
  innerType?: z.ZodType;
  in?: z.ZodType;
  element?: z.ZodType;
  checks?: readonly { _zod: { def: Record<string, unknown> } }[];
}

const definition = (schema: z.ZodType) =>
  (schema as unknown as { _zod: { def: Definition } })._zod.def;

/** The schema of a dotted path of a form (`members.0.email`), wrappers removed. */
export function schemaAt(schema: z.ZodType, path: string): z.ZodType | undefined {
  let current: z.ZodType | undefined = schema;
  const segments = path.split('.').filter(Boolean);
  for (;;) {
    if (!current) return undefined;
    const def = definition(current);
    const inner = def.innerType ?? (def.type === 'pipe' ? def.in : undefined);
    if (inner) {
      current = inner;
      continue;
    }
    const segment = segments.shift();
    if (segment === undefined) return current;
    if (def.type === 'object') current = def.shape?.[segment];
    else if (def.type === 'array' && /^\d+$/.test(segment)) current = def.element;
    else return undefined;
  }
}

/**
 * The bounds of a field for an issue the api reported without them (`too_small`, `too_big`): the
 * schema of the form holds the same rules as the api's (contracts).
 */
export function boundsOf(schema: z.ZodType, path: string): Partial<IssueLike> {
  const field = schemaAt(schema, path);
  if (!field) return {};
  const def = definition(field);
  const bounds: Partial<IssueLike> = {
    origin: def.type,
    ...(def.format ? { format: def.format } : {}),
  };
  for (const check of def.checks ?? []) {
    const rule = check._zod.def;
    if (rule['check'] === 'max_length') bounds.maximum = rule['maximum'] as number;
    if (rule['check'] === 'min_length') bounds.minimum = rule['minimum'] as number;
    if (rule['check'] === 'less_than') bounds.maximum = rule['value'] as number;
    if (rule['check'] === 'greater_than') bounds.minimum = rule['value'] as number;
    if (rule['check'] === 'string_format') bounds.format = rule['format'] as string;
  }
  return bounds;
}
