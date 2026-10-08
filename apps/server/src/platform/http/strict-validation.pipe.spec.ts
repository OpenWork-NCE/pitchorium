import { createZodDto, ZodValidationException } from 'nestjs-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toProblem } from './problem-details';
import { StrictValidationPipe, unknownKeys } from './strict-validation.pipe';

class BodyDto extends createZodDto(
  z.object({
    title: z.string().max(10),
    tiers: z.array(z.object({ label: z.string().max(10) })).max(3),
    note: z.string().max(10).optional(),
  }),
) {}

describe('StrictValidationPipe', () => {
  const pipe = new StrictValidationPipe();

  it('accepts a body that only carries known keys', async () => {
    const body = { title: 'Cacao', tiers: [{ label: 'A' }] };
    await expect(pipe.transform(body, { type: 'body', metatype: BodyDto })).resolves.toEqual(body);
  });

  it('refuses unknown keys at any depth, with their pointer', async () => {
    const body = { title: 'Cacao', admin: true, tiers: [{ label: 'A', amount: 5 }] };
    const error = await pipe
      .transform(body, { type: 'body', metatype: BodyDto })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ZodValidationException);
    expect(toProblem(error as ZodValidationException).errors).toEqual([
      { pointer: '/admin', code: 'unrecognized_keys' },
      { pointer: '/tiers/0/amount', code: 'unrecognized_keys' },
    ]);
  });

  it('leaves query strings tolerant', async () => {
    const query = { title: 'Cacao', tiers: [], _: '123' };
    await expect(pipe.transform(query, { type: 'query', metatype: BodyDto })).resolves.toEqual({
      title: 'Cacao',
      tiers: [],
    });
  });

  it('finds nothing when parsing kept every key', () => {
    expect(unknownKeys({ a: [{ b: 1 }] }, { a: [{ b: 1 }], c: 2 })).toEqual([]);
  });
});
