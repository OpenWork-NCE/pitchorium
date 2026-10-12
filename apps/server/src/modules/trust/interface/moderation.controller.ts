import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  appealIdParamsSchema,
  assignModerationCaseRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  decideModerationCaseRequestSchema,
  liftSuspensionRequestSchema,
  type ModerationCase,
  type ModerationCaseDetail,
  moderationCaseDetailSchema,
  moderationCaseIdParamsSchema,
  moderationCasePageSchema,
  type ModerationAppealItem,
  moderationAppealPageSchema,
  type ModerationDecisionDetail,
  moderationDecisionDetailSchema,
  type ModerationPerson,
  moderationQueueQuerySchema,
  moderatorListSchema,
  projectRefundsRequestSchema,
  projectRefundsResultSchema,
  resolveAppealRequestSchema,
  staffSuspensionRequestSchema,
  type Suspension,
  suspensionIdParamsSchema,
  suspensionSchema,
  type TransparencyReport,
  transparencyQuerySchema,
  transparencyReportSchema,
  uuidV7Schema,
} from '@pitchorium/contracts';
import type { Request } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { type Actor, CurrentActor } from '../../access';
import { ModerationService } from '../application/moderation.service';
import { SuspensionsService } from '../application/suspensions.service';
import { TransparencyService } from '../application/transparency.service';

class CasePageDto extends createZodDto(moderationCasePageSchema) {}
class CaseDetailDto extends createZodDto(moderationCaseDetailSchema) {}
class DecisionDetailDto extends createZodDto(moderationDecisionDetailSchema) {}
class AppealPageDto extends createZodDto(moderationAppealPageSchema) {}
class ModeratorListDto extends createZodDto(moderatorListSchema) {}
class StaffSuspensionDto extends createZodDto(staffSuspensionRequestSchema) {}
class MemberParamsDto extends createZodDto(z.object({ userId: uuidV7Schema })) {}
class SuspensionDto extends createZodDto(suspensionSchema) {}
class TransparencyDto extends createZodDto(transparencyReportSchema) {}
class RefundsResultDto extends createZodDto(projectRefundsResultSchema) {}
class ModerationQueueQueryDto extends createZodDto(moderationQueueQuerySchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}
class TransparencyQueryDto extends createZodDto(transparencyQuerySchema) {}
class AssignDto extends createZodDto(assignModerationCaseRequestSchema) {}
class DecideDto extends createZodDto(decideModerationCaseRequestSchema) {}
class ResolveAppealDto extends createZodDto(resolveAppealRequestSchema) {}
class LiftDto extends createZodDto(liftSuspensionRequestSchema) {}
class RefundsDto extends createZodDto(projectRefundsRequestSchema) {}
class CaseIdParamsDto extends createZodDto(moderationCaseIdParamsSchema) {}
class AppealIdParamsDto extends createZodDto(appealIdParamsSchema) {}
class SuspensionIdParamsDto extends createZodDto(suspensionIdParamsSchema) {}
class ReportedProjectIdParamsDto extends createZodDto(z.object({ projectId: uuidV7Schema })) {}

const requestIdOf = (request: Request) => (typeof request.id === 'string' ? request.id : undefined);

/**
 * Moderation tools (§13), under the administration convention `/v1/admin/<area>`: queue,
 * case, assignment, decision, appeals, suspensions, refunds of a frozen project and
 * transparency counters. Moderators and administrators with two-factor authentication.
 */
@ApiTags('admin-moderation')
@Controller('admin/moderation')
export class ModerationController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly suspensions: SuspensionsService,
    private readonly transparency: TransparencyService,
  ) {}

  /** Open cases by priority (fraud on a project in funding first), then the oldest. */
  @Get('cases')
  @RequireAction('trust.moderation.read')
  @ZodSerializerDto(CasePageDto)
  @ApiOkResponse({ type: CasePageDto.Output })
  queue(
    @CurrentPrincipal() principal: Principal,
    @Query() query: ModerationQueueQueryDto,
  ): Promise<CursorPage<ModerationCase>> {
    return this.moderation.queue(principal.userId, query);
  }

  /** The case with its reports and their limited context; the reading is audited. */
  @Get('cases/:caseId')
  @RequireAction('trust.moderation.read')
  @ZodSerializerDto(CaseDetailDto)
  @ApiOkResponse({ type: CaseDetailDto.Output })
  detail(
    @CurrentPrincipal() principal: Principal,
    @Param() params: CaseIdParamsDto,
  ): Promise<ModerationCaseDetail> {
    return this.moderation.detail(principal.userId, params.caseId);
  }

  /** Assigns the case to a moderator (null: unassigned); the history is kept. */
  @Post('cases/:caseId/assignment')
  @RequireAction('trust.moderation.assign')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(CaseDetailDto)
  @ApiOkResponse({ type: CaseDetailDto.Output })
  assign(
    @CurrentPrincipal() principal: Principal,
    @Param() params: CaseIdParamsDto,
    @Body() body: AssignDto,
  ): Promise<ModerationCaseDetail> {
    return this.moderation.assign(principal.userId, params.caseId, body.moderatorId);
  }

  /**
   * Decision with its statement of reasons. A permanent suspension, one longer than
   * TRUST_MODERATOR_MAX_SUSPENSION_DAYS and the freeze of a project need the admin role; the
   * freeze and a permanent suspension a recent session (trust.project.freeze,
   * trust.suspension.permanent).
   */
  @Post('cases/:caseId/decisions')
  @RequireAction('trust.moderation.decide')
  @Idempotent()
  @ZodSerializerDto(DecisionDetailDto)
  @ApiCreatedResponse({ type: DecisionDetailDto.Output })
  async decide(
    @CurrentActor() actor: Actor,
    @Param() params: CaseIdParamsDto,
    @Body() body: DecideDto,
    @Req() request: Request,
  ): Promise<ModerationDecisionDetail> {
    await this.moderation.assertRecentForSensitive(actor, body, requestIdOf(request));
    return this.moderation.decide(actor.userId, params.caseId, body);
  }

  /** Pending appeals with their decision, and whether the reader may resolve each. */
  @Get('appeals')
  @RequireAction('trust.moderation.read')
  @ZodSerializerDto(AppealPageDto)
  @ApiOkResponse({ type: AppealPageDto.Output })
  appeals(
    @CurrentPrincipal() principal: Principal,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<ModerationAppealItem>> {
    return this.moderation.pendingAppeals(principal.userId, query);
  }

  /** The moderators and administrators a case may be assigned to. */
  @Get('moderators')
  @RequireAction('trust.moderation.assign')
  @ZodSerializerDto(ModeratorListDto)
  @ApiOkResponse({ type: ModeratorListDto.Output })
  async moderators(): Promise<{ items: ModerationPerson[] }> {
    return { items: await this.moderation.moderators() };
  }

  /**
   * A suspension decided from the file of a member: the open case of their profile is decided,
   * or a case is opened for it (`staff`), with the same statement of reasons and limits.
   */
  @Post('members/:userId/suspensions')
  @RequireAction('trust.moderation.decide')
  @Idempotent()
  @ZodSerializerDto(DecisionDetailDto)
  @ApiCreatedResponse({ type: DecisionDetailDto.Output })
  async suspendMember(
    @CurrentActor() actor: Actor,
    @Param() params: MemberParamsDto,
    @Body() body: StaffSuspensionDto,
    @Req() request: Request,
  ): Promise<ModerationDecisionDetail> {
    await this.moderation.assertRecentForSensitive(
      actor,
      { kind: 'suspend', suspensionDays: body.suspensionDays },
      requestIdOf(request),
    );
    return this.moderation.suspendMember(actor.userId, params.userId, body);
  }

  /** Final decision on an appeal, by someone other than the author of the decision. */
  @Post('appeals/:appealId/resolution')
  @RequireAction('trust.appeal.resolve')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(DecisionDetailDto)
  @ApiOkResponse({ type: DecisionDetailDto.Output })
  resolveAppeal(
    @CurrentPrincipal() principal: Principal,
    @Param() params: AppealIdParamsDto,
    @Body() body: ResolveAppealDto,
  ): Promise<ModerationDecisionDetail> {
    return this.moderation.resolveAppeal(
      principal.userId,
      params.appealId,
      body.outcome,
      body.statement,
    );
  }

  @Post('suspensions/:suspensionId/lift')
  @RequireAction('trust.suspension.lift')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(SuspensionDto)
  @ApiOkResponse({ type: SuspensionDto.Output })
  lift(
    @CurrentPrincipal() principal: Principal,
    @Param() params: SuspensionIdParamsDto,
    @Body() body: LiftDto,
  ): Promise<Suspension> {
    return this.suspensions.lift(principal.userId, params.suspensionId, body.statement);
  }

  /** Refunds every paid contribution of a project frozen by the decision (admins). */
  @Post('projects/:projectId/refunds')
  @RequireAction('trust.project.refund')
  @Idempotent()
  @HttpCode(HttpStatus.ACCEPTED)
  @ZodSerializerDto(RefundsResultDto)
  @ApiAcceptedResponse({ type: RefundsResultDto.Output })
  refunds(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ReportedProjectIdParamsDto,
    @Body() body: RefundsDto,
  ): Promise<{ queued: number }> {
    return this.moderation.refundFrozenProject(
      principal.userId,
      params.projectId,
      body.decisionId,
      body.reason,
    );
  }

  /** Aggregated counters of a period (`to` included): reports, decisions, delays, appeals. */
  @Get('transparency')
  @RequireAction('trust.transparency.read')
  @ZodSerializerDto(TransparencyDto)
  @ApiOkResponse({ type: TransparencyDto.Output })
  report(@Query() query: TransparencyQueryDto): Promise<TransparencyReport> {
    return this.transparency.report(query.from, query.to);
  }
}
