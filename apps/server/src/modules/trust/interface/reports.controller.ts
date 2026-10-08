import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  anonymousReportRequestSchema,
  createReportRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  type Report,
  type ReportReceipt,
  reportPageSchema,
  reportReceiptSchema,
  reportSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { ReportsService } from '../application/reports.service';

class CreateReportDto extends createZodDto(createReportRequestSchema) {}
class AnonymousReportDto extends createZodDto(anonymousReportRequestSchema) {}
class ReportDto extends createZodDto(reportSchema) {}
class ReportPageDto extends createZodDto(reportPageSchema) {}
class ReportReceiptDto extends createZodDto(reportReceiptSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}

/** Notices without an account per client address and hour (provisional). */
export const ANONYMOUS_REPORTS_PER_HOUR = 5;

/**
 * Reports (§13, notice and action): by a member on any target, or as a notice of illegal
 * content without an account. The reporter is acknowledged, then told the outcome.
 */
@ApiTags('trust')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** A member reports a target once while its case is open; a profile by its handle. */
  @Post('reports')
  @RequireAction('trust.report.create')
  @Idempotent()
  @ZodSerializerDto(ReportDto)
  @ApiCreatedResponse({ type: ReportDto.Output })
  report(@CurrentPrincipal() principal: Principal, @Body() body: CreateReportDto): Promise<Report> {
    return this.reports.report(principal.userId, body);
  }

  @Get('me/reports')
  @RequireAction('trust.report.read')
  @ZodSerializerDto(ReportPageDto)
  @ApiOkResponse({ type: ReportPageDto.Output })
  mine(
    @CurrentPrincipal() principal: Principal,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<Report>> {
    return this.reports.mine(principal.userId, query);
  }

  /**
   * Notice of illegal content without an account (a message cannot be the target): rate
   * limited per address, receipt and outcome sent to the optional email.
   */
  @Post('public/reports')
  @Public()
  @Throttle({ default: { limit: ANONYMOUS_REPORTS_PER_HOUR, ttl: 3_600_000 } })
  @ZodSerializerDto(ReportReceiptDto)
  @ApiCreatedResponse({ type: ReportReceiptDto.Output })
  notice(@Body() body: AnonymousReportDto): Promise<ReportReceipt> {
    return this.reports.notice(body);
  }
}
