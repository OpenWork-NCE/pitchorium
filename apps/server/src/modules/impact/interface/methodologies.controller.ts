import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type AdminImpactMethodology,
  adminImpactMethodologyListSchema,
  adminImpactMethodologySchema,
  createImpactMethodologyRequestSchema,
  type ImpactMethodology,
  type ImpactScorePreview,
  impactScorePreviewRequestSchema,
  impactScorePreviewSchema,
  impactMethodologyIdParamsSchema,
  impactMethodologySchema,
  updateImpactMethodologyRequestSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { MethodologiesService } from '../application/methodologies.service';
import { unavailable } from '../domain/assessment';
import { methodologyView } from '../domain/methodology';

class MethodologyDto extends createZodDto(impactMethodologySchema) {}
class AdminMethodologyDto extends createZodDto(adminImpactMethodologySchema) {}
class AdminMethodologiesDto extends createZodDto(adminImpactMethodologyListSchema) {}
class ScorePreviewRequestDto extends createZodDto(impactScorePreviewRequestSchema) {}
class ScorePreviewDto extends createZodDto(impactScorePreviewSchema) {}
class CreateMethodologyDto extends createZodDto(createImpactMethodologyRequestSchema) {}
class UpdateMethodologyDto extends createZodDto(updateImpactMethodologyRequestSchema) {}
class MethodologyIdParamsDto extends createZodDto(impactMethodologyIdParamsSchema) {}

/** A new version must show quickly, for the assessment forms. */
const PUBLISHED_METHODOLOGY_CACHE = 'public, max-age=60';

/** Versions of the impact methodology (section 12, ADR 0036). */
@ApiTags('impact')
@Controller()
export class MethodologiesController {
  constructor(private readonly methodologies: MethodologiesService) {}

  /** The published version and its criteria; IMPACT_METHODOLOGY_UNAVAILABLE without one. */
  @Get('impact/methodology')
  @Public()
  @ZodSerializerDto(MethodologyDto)
  @ApiOkResponse({ type: MethodologyDto.Output })
  async published(@Res({ passthrough: true }) response: Response): Promise<ImpactMethodology> {
    const published = await this.methodologies.published();
    if (!published) throw unavailable();
    response.setHeader('Cache-Control', PUBLISHED_METHODOLOGY_CACHE);
    return methodologyView(published);
  }

  @Get('admin/impact/methodologies')
  @RequireAction('impact.methodology.manage')
  @ZodSerializerDto(AdminMethodologiesDto)
  @ApiOkResponse({ type: AdminMethodologiesDto.Output })
  async list(): Promise<{ items: AdminImpactMethodology[] }> {
    return {
      items: await Promise.all(
        (await this.methodologies.list()).map((methodology) =>
          this.methodologies.adminView(methodology),
        ),
      ),
    };
  }

  @Post('admin/impact/methodologies')
  @RequireAction('impact.methodology.manage')
  @Idempotent()
  @ZodSerializerDto(AdminMethodologyDto)
  @ApiCreatedResponse({ type: AdminMethodologyDto.Output })
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateMethodologyDto,
  ): Promise<AdminImpactMethodology> {
    return this.methodologies.adminView(
      await this.methodologies.createDraft(principal.userId, body),
    );
  }

  @Get('admin/impact/methodologies/:methodologyId')
  @RequireAction('impact.methodology.manage')
  @ZodSerializerDto(AdminMethodologyDto)
  @ApiOkResponse({ type: AdminMethodologyDto.Output })
  async get(@Param() params: MethodologyIdParamsDto): Promise<AdminImpactMethodology> {
    return this.methodologies.adminView(await this.methodologies.require(params.methodologyId));
  }

  /** Replaces the name and the criteria of a draft; a published version never changes. */
  @Put('admin/impact/methodologies/:methodologyId')
  @RequireAction('impact.methodology.manage')
  @ZodSerializerDto(AdminMethodologyDto)
  @ApiOkResponse({ type: AdminMethodologyDto.Output })
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MethodologyIdParamsDto,
    @Body() body: UpdateMethodologyDto,
  ): Promise<AdminImpactMethodology> {
    return this.methodologies.adminView(
      await this.methodologies.updateDraft(principal.userId, params.methodologyId, body),
    );
  }

  @Delete('admin/impact/methodologies/:methodologyId')
  @RequireAction('impact.methodology.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MethodologyIdParamsDto,
  ): Promise<void> {
    await this.methodologies.deleteDraft(principal.userId, params.methodologyId);
  }

  /** The draft becomes the published version; the previous published version is archived. */
  @Post('admin/impact/methodologies/:methodologyId/publish')
  @RequireAction('impact.methodology.manage')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(AdminMethodologyDto)
  @ApiOkResponse({ type: AdminMethodologyDto.Output })
  async publish(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MethodologyIdParamsDto,
  ): Promise<AdminImpactMethodology> {
    return this.methodologies.adminView(
      await this.methodologies.publish(principal.userId, params.methodologyId),
    );
  }

  /** Withdraws the published version: assessments are unavailable until another one. */
  @Post('admin/impact/methodologies/:methodologyId/archive')
  @RequireAction('impact.methodology.manage')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(AdminMethodologyDto)
  @ApiOkResponse({ type: AdminMethodologyDto.Output })
  async archive(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MethodologyIdParamsDto,
  ): Promise<AdminImpactMethodology> {
    return this.methodologies.adminView(
      await this.methodologies.archive(principal.userId, params.methodologyId),
    );
  }

  /** The score some answers would give with this version, by the rules of an assessment. */
  @Post('admin/impact/methodologies/:methodologyId/preview')
  @RequireAction('impact.methodology.manage')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ScorePreviewDto)
  @ApiOkResponse({ type: ScorePreviewDto.Output })
  preview(
    @Param() params: MethodologyIdParamsDto,
    @Body() body: ScorePreviewRequestDto,
  ): Promise<ImpactScorePreview> {
    return this.methodologies.preview(params.methodologyId, body.answers);
  }
}
