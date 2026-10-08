import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Schema {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  maxLength?: number;
  maxItems?: number;
  enum?: unknown[];
  const?: unknown;
  format?: string;
  pattern?: string;
}

const DOCUMENT = JSON.parse(
  readFileSync(join(__dirname, '../../openapi/openapi.json'), 'utf8'),
) as {
  paths: Record<
    string,
    Record<
      string,
      {
        requestBody?: { content?: Record<string, { schema?: Schema }> };
        parameters?: { name: string; in: string; schema?: Schema }[];
      }
    >
  >;
  components: { schemas: Record<string, Schema> };
};

function resolve(schema: Schema | undefined): Schema | undefined {
  let current = schema;
  while (current?.$ref) {
    current = DOCUMENT.components.schemas[current.$ref.split('/').at(-1)!];
  }
  return current;
}

const bounded = (schema: Schema) =>
  schema.maxLength !== undefined ||
  schema.enum !== undefined ||
  schema.const !== undefined ||
  schema.format !== undefined ||
  schema.pattern !== undefined;

/** Strings without a length bound and lists without a size bound, at any depth. */
function unbounded(schema: Schema | undefined, path: string, seen = new Set<Schema>()): string[] {
  const current = resolve(schema);
  if (!current || seen.has(current)) return [];
  seen.add(current);
  const types = Array.isArray(current.type) ? current.type : [current.type];
  const found: string[] = [];
  for (const variant of [
    ...(current.anyOf ?? []),
    ...(current.oneOf ?? []),
    ...(current.allOf ?? []),
  ]) {
    found.push(...unbounded(variant, path, seen));
  }
  for (const [key, value] of Object.entries(current.properties ?? {})) {
    found.push(...unbounded(value, `${path}.${key}`, seen));
  }
  if (typeof current.additionalProperties === 'object') {
    found.push(...unbounded(current.additionalProperties, `${path}.*`, seen));
  }
  if (types.includes('array')) {
    if (current.maxItems === undefined) found.push(`${path}: list without maxItems`);
    found.push(...unbounded(current.items, `${path}[]`, seen));
  }
  if (types.includes('string') && !bounded(current)) found.push(`${path}: string without bound`);
  return found;
}

/**
 * Inputs of the public API (ASVS V5.1.3, V5.1.4): every string and every list of a request
 * body or parameter is bounded; unknown keys are refused at runtime (StrictValidationPipe).
 */
describe('request contracts', () => {
  it('bounds every string and every list of the inputs', () => {
    const found: string[] = [];
    for (const [path, operations] of Object.entries(DOCUMENT.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        const route = `${method.toUpperCase()} ${path}`;
        const body = operation.requestBody?.content?.['application/json']?.schema;
        if (body) found.push(...unbounded(body, route));
        for (const parameter of operation.parameters ?? []) {
          found.push(...unbounded(parameter.schema, `${route} ${parameter.in} ${parameter.name}`));
        }
      }
    }
    expect(found).toEqual([]);
  });
});
