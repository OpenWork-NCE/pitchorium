import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  type AuditEntry,
  auditExportQuerySchema,
  auditPageSchema,
  auditQuerySchema,
  type ConsoleQueues,
  consoleQueuesSchema,
  type CursorPage,
  type FailedJob,
  failedJobListSchema,
  failedJobsQuerySchema,
  type FeatureFlagChange,
  featureFlagHistorySchema,
  featureFlagKeyParamsSchema,
  featureFlagListSchema,
  featureFlagSchema,
  type FeatureFlagView,
  type Highlight,
  highlightListQuerySchema,
  highlightListSchema,
  highlightParamsSchema,
  jobParamsSchema,
  type JobRetryResult,
  jobRetryResultSchema,
  type MemberFile,
  memberFileSchema,
  memberIdParamsSchema,
  memberSearchQuerySchema,
  type MemberSummary,
  memberSummaryPageSchema,
  type PlatformStats,
  platformStatsSchema,
  updateFeatureFlagRequestSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { type Actor, CurrentActor } from '../../access';
import { BackOfficeService } from '../application/back-office.service';

class MemberSearchQueryDto extends createZodDto(memberSearchQuerySchema) {}
class MemberSummaryPageDto extends createZodDto(memberSummaryPageSchema) {}
class MemberFileDto extends createZodDto(memberFileSchema) {}
class MemberIdParamsDto extends createZodDto(memberIdParamsSchema) {}
class FlagListDto extends createZodDto(featureFlagListSchema) {}
class FlagDto extends createZodDto(featureFlagSchema) {}
class FlagKeyParamsDto extends createZodDto(featureFlagKeyParamsSchema) {}
class UpdateFlagDto extends createZodDto(updateFeatureFlagRequestSchema) {}
class HighlightListDto extends createZodDto(highlightListSchema) {}
class HighlightListQueryDto extends createZodDto(highlightListQuerySchema) {}
class HighlightParamsDto extends createZodDto(highlightParamsSchema) {}
class FailedJobListDto extends createZodDto(failedJobListSchema) {}
class FailedJobsQueryDto extends createZodDto(failedJobsQuerySchema) {}
class JobParamsDto extends createZodDto(jobParamsSchema) {}
class JobRetryDto extends createZodDto(jobRetryResultSchema) {}
class StatsDto extends createZodDto(platformStatsSchema) {}
class AuditQueryDto extends createZodDto(auditQuerySchema) {}
class AuditPageDto extends createZodDto(auditPageSchema) {}
class AuditExportQueryDto extends createZodDto(auditExportQuerySchema) {}
class FlagHistoryDto extends createZodDto(featureFlagHistorySchema) {}
class QueuesDto extends createZodDto(consoleQueuesSchema) {}

/**
 * Back office under `/v1/admin` (§13, §14): members, feature flags, editorial highlights,
 * jobs failed for good, statistics and audit log. Administrators with two-factor
 * authentication; highlights for moderators too.
 */
@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly backOffice: BackOfficeService) {}

  /** By part of the email or the name, or an exact handle; the search is audited. */
  @Get('members')
  @RequireAction('admin.members.read')
  @ZodSerializerDto(MemberSummaryPageDto)
  @ApiOkResponse({ type: MemberSummaryPageDto.Output })
  members(
    @CurrentPrincipal() principal: Principal,
    @Query() query: MemberSearchQueryDto,
  ): Promise<CursorPage<MemberSummary>> {
    return this.backOffice.searchMembers(principal.userId, query);
  }

  /** The file of a member (account, roles, suspension, KYC); the reading is audited. */
  @Get('members/:userId')
  @RequireAction('admin.members.read')
  @ZodSerializerDto(MemberFileDto)
  @ApiOkResponse({ type: MemberFileDto.Output })
  member(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberIdParamsDto,
  ): Promise<MemberFile> {
    return this.backOffice.memberFile(principal.userId, params.userId);
  }

  /** Signs the member out on every device; audited. */
  @Post('members/:userId/sessions/revocation')
  @RequireAction('admin.sessions.revoke')
  @Idempotent()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  revokeSessions(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberIdParamsDto,
  ): Promise<void> {
    return this.backOffice.revokeSessions(principal.userId, params.userId);
  }

  /** The queues the reader may work in, with what waits in each (ADR 0172). */
  @Get('queues')
  @RequireAction('admin.console.read')
  @ZodSerializerDto(QueuesDto)
  @ApiOkResponse({ type: QueuesDto.Output })
  queues(@CurrentActor() actor: Actor): Promise<ConsoleQueues> {
    return this.backOffice.queues(actor);
  }

  @Get('feature-flags')
  @RequireAction('admin.flags.read')
  @ZodSerializerDto(FlagListDto)
  @ApiOkResponse({ type: FlagListDto.Output })
  async flags(): Promise<{ items: FeatureFlagView[] }> {
    return { items: await this.backOffice.flagList() };
  }

  /**
   * Recent session required. `locale.*`: complete and reviewed catalogue only
   * (LOCALIZATION_LOCALE_NOT_READY); `funding.equity` and `funding.loans`: legal reference
   * required to enable (ADMIN_LEGAL_REFERENCE_REQUIRED), online payment still refused.
   */
  @Patch('feature-flags/:key')
  @RequireAction('admin.flags.manage')
  @Idempotent()
  @ZodSerializerDto(FlagDto)
  @ApiOkResponse({ type: FlagDto.Output })
  updateFlag(
    @CurrentPrincipal() principal: Principal,
    @Param() params: FlagKeyParamsDto,
    @Body() body: UpdateFlagDto,
  ): Promise<FeatureFlagView> {
    return this.backOffice.updateFlag(principal.userId, params.key, body);
  }

  /** The changes of a flag, latest first, with their author and legal reference. */
  @Get('feature-flags/:key/history')
  @RequireAction('admin.flags.read')
  @ZodSerializerDto(FlagHistoryDto)
  @ApiOkResponse({ type: FlagHistoryDto.Output })
  async flagHistory(@Param() params: FlagKeyParamsDto): Promise<{ items: FeatureFlagChange[] }> {
    return { items: await this.backOffice.flagHistory(params.key) };
  }

  @Get('highlights')
  @RequireAction('admin.highlights.manage')
  @ZodSerializerDto(HighlightListDto)
  @ApiOkResponse({ type: HighlightListDto.Output })
  async highlights(@Query() query: HighlightListQueryDto): Promise<{ items: Highlight[] }> {
    return { items: await this.backOffice.highlights(query.targetType) };
  }

  /** Features a publication, a project (by id) or a public profile (by handle). */
  @Put('highlights/:targetType/:targetId')
  @RequireAction('admin.highlights.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  feature(
    @CurrentPrincipal() principal: Principal,
    @Param() params: HighlightParamsDto,
  ): Promise<void> {
    return this.backOffice.setHighlight(principal.userId, params.targetType, params.targetId, true);
  }

  @Delete('highlights/:targetType/:targetId')
  @RequireAction('admin.highlights.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  unfeature(
    @CurrentPrincipal() principal: Principal,
    @Param() params: HighlightParamsDto,
  ): Promise<void> {
    return this.backOffice.setHighlight(
      principal.userId,
      params.targetType,
      params.targetId,
      false,
    );
  }

  /** Jobs failed for good (attempts exhausted), kept 7 days, every queue or one. */
  @Get('jobs/failed')
  @RequireAction('admin.jobs.read')
  @ZodSerializerDto(FailedJobListDto)
  @ApiOkResponse({ type: FailedJobListDto.Output })
  async failedJobs(@Query() query: FailedJobsQueryDto): Promise<{ items: FailedJob[] }> {
    return { items: await this.backOffice.failedJobs(query.queue, query.limit) };
  }

  @Post('jobs/:queue/:jobId/retry')
  @RequireAction('admin.jobs.retry')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(JobRetryDto)
  @ApiOkResponse({ type: JobRetryDto.Output })
  retry(
    @CurrentPrincipal() principal: Principal,
    @Param() params: JobParamsDto,
  ): Promise<JobRetryResult> {
    return this.backOffice.retryJob(principal.userId, params.queue, params.jobId);
  }

  @Get('stats')
  @RequireAction('admin.stats.read')
  @ZodSerializerDto(StatsDto)
  @ApiOkResponse({ type: StatsDto.Output })
  stats(): Promise<PlatformStats> {
    return this.backOffice.statistics();
  }

  @Get('audit-log')
  @RequireAction('admin.audit.read')
  @ZodSerializerDto(AuditPageDto)
  @ApiOkResponse({ type: AuditPageDto.Output })
  auditLog(
    @CurrentPrincipal() principal: Principal,
    @Query() query: AuditQueryDto,
  ): Promise<CursorPage<AuditEntry>> {
    return this.backOffice.auditLog(principal.userId, query);
  }

  /** The audit log filtered as on its screen, in CSV (RFC 4180, UTF-8); the export is audited. */
  @Get('audit-log/export')
  @RequireAction('admin.audit.export')
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV file', schema: { type: 'string' } })
  async auditExport(
    @CurrentPrincipal() principal: Principal,
    @Query() query: AuditExportQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const csv = await this.backOffice.auditExport(principal.userId, query);
    response
      .status(HttpStatus.OK)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"')
      .setHeader('Cache-Control', 'private, no-store')
      .send(csv);
  }
}
