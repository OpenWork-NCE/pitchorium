import type { OpenAPIObject } from '@nestjs/swagger';
import { describe, expect, it } from 'vitest';
import { restoreNullableProperties } from './openapi';

describe('OpenAPI document', () => {
  it('gives a nullable property of the first level its type back, not an array', () => {
    const document = {
      openapi: '3.1.0',
      info: { title: 'test', version: '1' },
      paths: {},
      components: {
        schemas: {
          PageDto_Output: {
            type: 'object',
            properties: {
              nextCursor: {
                'x-nestjs_zod-empty-type': true,
                type: 'array',
                items: { type: 'string' },
              },
              items: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    } as unknown as OpenAPIObject;
    const properties = (
      restoreNullableProperties(document).components?.schemas?.['PageDto_Output'] as {
        properties: Record<string, unknown>;
      }
    ).properties;
    expect(properties['nextCursor']).toEqual({
      'x-nestjs_zod-empty-type': true,
      type: ['string', 'null'],
    });
    // A real array keeps its items.
    expect(properties['items']).toEqual({ type: 'array', items: { type: 'string' } });
  });
});
