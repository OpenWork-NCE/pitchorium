import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type Appeal,
  appealDecisionRequestSchema,
  appealSchema,
  type CursorPage,
  cursorPageQuerySchema,
  type ModerationDecision,
  moderationDecisionIdParamsSchema,
  moderationDecisionPageSchema,
  type ModerationStanding,
  moderationStandingSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { StandingService } from '../application/standing.service';
import { DecisionSubjectResolver } from './decision-subject.resolver';

class StandingDto extends createZodDto(moderationStandingSchema) {}
class DecisionPageDto extends createZodDto(moderationDecisionPageSchema) {}
class AppealDto extends createZodDto(appealSchema) {}
class AppealRequestDto extends createZodDto(appealDecisionRequestSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}
class DecisionIdParamsDto extends createZodDto(moderationDecisionIdParamsSchema) {}

/**
 * The moderation of the member themself: open to a suspended member, who reads the notice and
 * the statement of reasons and appeals.
 */
@ApiTags('trust')
@Controller('me/moderation')
export class StandingController {
  constructor(private readonly standing: StandingService) {}

  @Get()
  @RequireAction('trust.standing.read')
  @ZodSerializerDto(StandingDto)
  @ApiOkResponse({ type: StandingDto.Output })
  read(@CurrentPrincipal() principal: Principal): Promise<ModerationStanding> {
    return this.standing.standing(principal.userId);
  }

  @Get('decisions')
  @RequireAction('trust.standing.read')
  @ZodSerializerDto(DecisionPageDto)
  @ApiOkResponse({ type: DecisionPageDto.Output })
  decisions(
    @CurrentPrincipal() principal: Principal,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<ModerationDecision>> {
    return this.standing.decisions(principal.userId, query);
  }

  /** One appeal per decision, reviewed by another moderator than the author. */
  @Post('decisions/:decisionId/appeal')
  @RequireAction('trust.decision.appeal', { resource: DecisionSubjectResolver })
  @Idempotent()
  @ZodSerializerDto(AppealDto)
  @ApiCreatedResponse({ type: AppealDto.Output })
  appeal(
    @CurrentPrincipal() principal: Principal,
    @Param() params: DecisionIdParamsDto,
    @Body() body: AppealRequestDto,
  ): Promise<Appeal> {
    return this.standing.appeal(principal.userId, params.decisionId, body.statement);
  }
}
