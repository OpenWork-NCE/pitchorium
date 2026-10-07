import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ZodValidationException } from 'nestjs-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DomainError } from '../kernel';
import { toProblem } from './problem-details';

describe('toProblem', () => {
  it('maps a DomainError to its registry status and exposes its message', () => {
    expect(toProblem(new DomainError('CONFLICT', 'Campaign is closed'))).toEqual({
      type: 'urn:pitchorium:problem:conflict',
      title: 'Conflict',
      status: 409,
      code: 'CONFLICT',
      detail: 'Campaign is closed',
    });
  });

  it('maps Zod validation errors to JSON pointers and issue codes', () => {
    const schema = z.object({ items: z.array(z.object({ 'a/b': z.string() })), limit: z.number() });
    const result = schema.safeParse({ items: [{ 'a/b': 1 }], limit: 'x' });
    const problem = toProblem(new ZodValidationException(result.error));

    expect(problem).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(problem.errors).toEqual([
      { pointer: '/items/0/a~1b', code: 'invalid_type' },
      { pointer: '/limit', code: 'invalid_type' },
    ]);
  });

  it.each([
    [new NotFoundException('Cannot GET /v1/secret-route'), 404, 'NOT_FOUND'],
    [new BadRequestException('internal parser message'), 400, 'BAD_REQUEST'],
    [new ThrottlerException(), 429, 'RATE_LIMITED'],
    [new HttpException('teapot', 418), 418, 'BAD_REQUEST'],
    [new HttpException('gateway', 502), 502, 'INTERNAL_ERROR'],
  ])('maps framework exception %# without leaking its message', (exception, status, code) => {
    const problem = toProblem(exception);
    expect(problem).toMatchObject({ status, code });
    expect(problem.detail).toBeUndefined();
  });

  it('maps body parser errors by status', () => {
    const parserError = Object.assign(new SyntaxError('Unexpected token'), { status: 400 });
    expect(toProblem(parserError)).toMatchObject({ status: 400, code: 'BAD_REQUEST' });
    expect(toProblem({ statusCode: 413 })).toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  it('hides unexpected errors behind INTERNAL_ERROR', () => {
    const problem = toProblem(new Error('password=hunter2 at db.internal:5432'));
    expect(problem).toEqual({
      type: 'urn:pitchorium:problem:internal-error',
      title: 'Internal error',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(toProblem('a string')).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(toProblem({ status: 503 })).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
