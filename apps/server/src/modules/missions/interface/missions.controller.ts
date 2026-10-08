import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  answerMissionEngagementRequestSchema,
  completeMissionEngagementRequestSchema,
  createMissionRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  type MissionCard,
  missionCardPageSchema,
  type MissionEngagement,
  missionEngagementIdParamsSchema,
  missionEngagementPageSchema,
  missionEngagementSchema,
  missionIdParamsSchema,
  missionListQuerySchema,
  missionSchema,
  type MissionView,
  myEngagementsQuerySchema,
  requestMissionEngagementRequestSchema,
  updateMissionRequestSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { DomainError } from '../../../platform/kernel';
import { MissionReadsService } from '../application/mission-reads.service';
import { MissionsService } from '../application/missions.service';
import { MissionsRepository } from '../application/ports';
import { EngagementResolver, MissionResolver } from './mission.resolvers';

class MissionDto extends createZodDto(missionSchema) {}
class MissionCardPageDto extends createZodDto(missionCardPageSchema) {}
class EngagementDto extends createZodDto(missionEngagementSchema) {}
class EngagementPageDto extends createZodDto(missionEngagementPageSchema) {}
/** Offers and requests share the fields; the route gives the direction. */
class CreateMissionDto extends createZodDto(createMissionRequestSchema.omit({ direction: true })) {}
class UpdateMissionDto extends createZodDto(updateMissionRequestSchema) {}
class RequestEngagementDto extends createZodDto(requestMissionEngagementRequestSchema) {}
class AnswerEngagementDto extends createZodDto(answerMissionEngagementRequestSchema) {}
class CompleteEngagementDto extends createZodDto(completeMissionEngagementRequestSchema) {}
class MissionListQueryDto extends createZodDto(missionListQuerySchema) {}
class MyEngagementsQueryDto extends createZodDto(myEngagementsQuerySchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}
class MissionIdParamsDto extends createZodDto(missionIdParamsSchema) {}
class EngagementIdParamsDto extends createZodDto(missionEngagementIdParamsSchema) {}

const PUBLIC_MISSION_CACHE = 'public, max-age=60';

/**
 * Volunteer expertise missions (§6.3, §14, ADR 0071): offers and requests, engagements from
 * the application or solicitation to the completion, with the time declared in the shared
 * time log. Never a job offer.
 */
@ApiTags('missions')
@Controller()
export class MissionsController {
  constructor(
    private readonly writes: MissionsService,
    private readonly reads: MissionReadsService,
    private readonly missions: MissionsRepository,
  ) {}

  /** Offer of an expert or a mentor (the hat matching the kind of the mission). */
  @Post('missions/offers')
  @RequireAction('mission.offer.create')
  @Idempotent()
  @ZodSerializerDto(MissionDto)
  @ApiCreatedResponse({ type: MissionDto.Output })
  async offer(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateMissionDto,
  ): Promise<MissionView> {
    const mission = await this.writes.create(principal.userId, 'offer', body);
    return this.view(mission.id, principal.userId);
  }

  /** Request of an entrepreneur, or of a project team (`projectId`). */
  @Post('missions/requests')
  @RequireAction('mission.request.create')
  @Idempotent()
  @ZodSerializerDto(MissionDto)
  @ApiCreatedResponse({ type: MissionDto.Output })
  async request(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateMissionDto,
  ): Promise<MissionView> {
    const mission = await this.writes.create(principal.userId, 'request', body);
    return this.view(mission.id, principal.userId);
  }

  @Get('missions')
  @RequireAction('mission.read')
  @ZodSerializerDto(MissionCardPageDto)
  @ApiOkResponse({ type: MissionCardPageDto.Output })
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: MissionListQueryDto,
  ): Promise<CursorPage<MissionCard>> {
    return this.reads.list(query, { kind: 'member', viewerId: principal.userId });
  }

  @Get('public/missions')
  @Public()
  @ZodSerializerDto(MissionCardPageDto)
  @ApiOkResponse({ type: MissionCardPageDto.Output })
  async publicList(
    @Query() query: MissionListQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<MissionCard>> {
    const page = await this.reads.list(query, { kind: 'public' });
    response.setHeader('Cache-Control', PUBLIC_MISSION_CACHE);
    return page;
  }

  @Get('me/missions')
  @RequireAction('mission.read')
  @ZodSerializerDto(MissionCardPageDto)
  @ApiOkResponse({ type: MissionCardPageDto.Output })
  mine(
    @CurrentPrincipal() principal: Principal,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<MissionCard>> {
    return this.reads.mine(principal.userId, query);
  }

  /** Engagements of the member, as expert or as beneficiary. */
  @Get('me/mission-engagements')
  @RequireAction('mission.read')
  @ZodSerializerDto(EngagementPageDto)
  @ApiOkResponse({ type: EngagementPageDto.Output })
  myEngagements(
    @CurrentPrincipal() principal: Principal,
    @Query() query: MyEngagementsQueryDto,
  ): Promise<CursorPage<MissionEngagement>> {
    return this.reads.engagementsOf(principal.userId, query);
  }

  @Get('public/missions/:missionId')
  @Public()
  @ZodSerializerDto(MissionDto)
  @ApiOkResponse({ type: MissionDto.Output })
  async forPublic(
    @Param() params: MissionIdParamsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MissionView> {
    const view = await this.reads.byId(params.missionId, { kind: 'public' });
    if (!view) throw new DomainError('MISSIONS_NOT_FOUND', 'Mission not found');
    response.setHeader('Cache-Control', PUBLIC_MISSION_CACHE);
    return view;
  }

  @Get('missions/:missionId')
  @RequireAction('mission.read', { resource: MissionResolver })
  @ZodSerializerDto(MissionDto)
  @ApiOkResponse({ type: MissionDto.Output })
  byId(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MissionIdParamsDto,
  ): Promise<MissionView> {
    return this.view(params.missionId, principal.userId);
  }

  @Patch('missions/:missionId')
  @RequireAction('mission.update', { resource: MissionResolver })
  @ZodSerializerDto(MissionDto)
  @ApiOkResponse({ type: MissionDto.Output })
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MissionIdParamsDto,
    @Body() body: UpdateMissionDto,
  ): Promise<MissionView> {
    await this.writes.update(params.missionId, body);
    return this.view(params.missionId, principal.userId);
  }

  /** No new engagement; those in progress go on. */
  @Post('missions/:missionId/close')
  @RequireAction('mission.close', { resource: MissionResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(MissionDto)
  @ApiOkResponse({ type: MissionDto.Output })
  async close(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MissionIdParamsDto,
  ): Promise<MissionView> {
    await this.writes.close(params.missionId, principal.userId);
    return this.view(params.missionId, principal.userId);
  }

  /** Application to a request, or solicitation of an offer, with a message. */
  @Post('missions/:missionId/engagements')
  @RequireAction('mission.engage', { resource: MissionResolver })
  @Idempotent()
  @ZodSerializerDto(EngagementDto)
  @ApiCreatedResponse({ type: EngagementDto.Output })
  async engage(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MissionIdParamsDto,
    @Body() body: RequestEngagementDto,
  ): Promise<MissionEngagement> {
    const engagement = await this.writes.request(params.missionId, principal.userId, body);
    return this.reads.engagementView(engagement);
  }

  /** Engagements of a mission, for its author. */
  @Get('missions/:missionId/engagements')
  @RequireAction('mission.update', { resource: MissionResolver })
  @ZodSerializerDto(EngagementPageDto)
  @ApiOkResponse({ type: EngagementPageDto.Output })
  engagements(
    @Param() params: MissionIdParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<MissionEngagement>> {
    return this.reads.engagementsOfMission(params.missionId, query);
  }

  @Get('mission-engagements/:engagementId')
  @RequireAction('mission.engagement.read', { resource: EngagementResolver })
  @ZodSerializerDto(EngagementDto)
  @ApiOkResponse({ type: EngagementDto.Output })
  engagement(@Param() params: EngagementIdParamsDto): Promise<MissionEngagement> {
    return this.engagementView(params.engagementId);
  }

  @Post('mission-engagements/:engagementId/accept')
  @RequireAction('mission.engagement.respond', { resource: EngagementResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(EngagementDto)
  @ApiOkResponse({ type: EngagementDto.Output })
  async accept(
    @Param() params: EngagementIdParamsDto,
    @Body() body: AnswerEngagementDto,
  ): Promise<MissionEngagement> {
    await this.writes.answer(params.engagementId, 'accepted', body.message);
    return this.engagementView(params.engagementId);
  }

  @Post('mission-engagements/:engagementId/decline')
  @RequireAction('mission.engagement.respond', { resource: EngagementResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(EngagementDto)
  @ApiOkResponse({ type: EngagementDto.Output })
  async decline(
    @Param() params: EngagementIdParamsDto,
    @Body() body: AnswerEngagementDto,
  ): Promise<MissionEngagement> {
    await this.writes.answer(params.engagementId, 'declined', body.message);
    return this.engagementView(params.engagementId);
  }

  /** By the expert, with the time spent: declared in the time log for the beneficiary. */
  @Post('mission-engagements/:engagementId/complete')
  @RequireAction('mission.engagement.complete', { resource: EngagementResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(EngagementDto)
  @ApiOkResponse({ type: EngagementDto.Output })
  async complete(
    @Param() params: EngagementIdParamsDto,
    @Body() body: CompleteEngagementDto,
  ): Promise<MissionEngagement> {
    await this.writes.complete(params.engagementId, body);
    return this.engagementView(params.engagementId);
  }

  @Post('mission-engagements/:engagementId/cancel')
  @RequireAction('mission.engagement.cancel', { resource: EngagementResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(EngagementDto)
  @ApiOkResponse({ type: EngagementDto.Output })
  async cancel(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EngagementIdParamsDto,
  ): Promise<MissionEngagement> {
    await this.writes.cancel(params.engagementId, principal.userId);
    return this.engagementView(params.engagementId);
  }

  private async view(missionId: string, viewerId: string): Promise<MissionView> {
    const view = await this.reads.byId(missionId, { kind: 'member', viewerId });
    if (!view) throw new DomainError('MISSIONS_NOT_FOUND', 'Mission not found');
    return view;
  }

  private async engagementView(engagementId: string): Promise<MissionEngagement> {
    const engagement = await this.missions.findEngagement(engagementId);
    if (!engagement) {
      throw new DomainError('MISSIONS_ENGAGEMENT_NOT_FOUND', 'Mission engagement not found');
    }
    return this.reads.engagementView(engagement);
  }
}
