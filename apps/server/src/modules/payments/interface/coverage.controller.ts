import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type PaymentCoverage, paymentCoverageSchema } from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { Public } from '../../../platform/http';
import { CoverageService } from '../application/coverage.service';

class PaymentCoverageDto extends createZodDto(paymentCoverageSchema) {}

/** The capability matrix changes with a deployment only: an hour of shared cache. */
const COVERAGE_CACHE = 'public, max-age=3600';

/** What the payments cover, readable by anyone before signing up (section 9.2, ADR 0133). */
@ApiTags('payments')
@Controller()
export class CoverageController {
  constructor(private readonly coverage: CoverageService) {}

  /**
   * Verified and enabled capabilities of each active provider: payout countries, currencies,
   * payments by contributor country with their bounds, eligibility of the holders, as codes.
   */
  @Get('public/payments/coverage')
  @Public()
  @ZodSerializerDto(PaymentCoverageDto)
  @ApiOkResponse({ type: PaymentCoverageDto.Output })
  read(@Res({ passthrough: true }) response: Response): PaymentCoverage {
    response.setHeader('Cache-Control', COVERAGE_CACHE);
    return this.coverage.coverage();
  }
}
