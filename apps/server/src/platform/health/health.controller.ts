import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { healthResponseSchema, type HealthResponse } from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { HealthService } from './health.service';

class HealthResponseDto extends createZodDto(healthResponseSchema) {}

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @ZodSerializerDto(HealthResponseDto)
  @ApiOkResponse({ type: HealthResponseDto.Output })
  live(): HealthResponse {
    return this.health.live();
  }

  @Get('ready')
  @ZodSerializerDto(HealthResponseDto)
  @ApiOkResponse({ type: HealthResponseDto.Output })
  @ApiServiceUnavailableResponse({ type: HealthResponseDto.Output })
  async ready(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const result = await this.health.ready();
    response.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
