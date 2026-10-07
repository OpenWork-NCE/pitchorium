import { Body, Controller, Get, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Public } from '../../../src/platform/http';
import { Idempotent } from '../../../src/platform/idempotency';
import { DomainError } from '../../../src/platform/kernel';

class CreateItemDto extends createZodDto(
  z.object({ name: z.string().min(1), quantity: z.number().int().positive() }),
) {}

/** Test-only routes exercising validation, idempotency and error mapping. */
@Public()
@Controller('test-items')
export class TestItemsController {
  created = 0;

  @Post()
  @Idempotent()
  create(@Body() body: CreateItemDto): { id: string; name: string; quantity: number } {
    this.created += 1;
    return { id: randomUUID(), ...body };
  }

  @Get('unexpected')
  unexpected(): never {
    throw new Error('connect ECONNREFUSED postgres://admin:secret@10.0.0.5:5432');
  }

  @Get('conflict')
  conflict(): never {
    throw new DomainError('CONFLICT', 'Item already archived');
  }
}
