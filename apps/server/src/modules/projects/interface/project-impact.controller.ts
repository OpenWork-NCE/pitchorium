import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type ImpactAssessment,
  impactAssessmentHistorySchema,
  impactAssessmentSchema,
  impactKeySchema,
  projectIdParamsSchema,
  submitImpactAssessmentRequestSchema,
  uuidV7Schema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { ProjectImpactService } from '../application/project-impact.service';
import { ProjectResolver } from './project.resolver';

const prefillSchema = z.object({
  methodologyId: uuidV7Schema,
  /** Answers of the entrepreneur facet of the owner still valid for the published version. */
  answers: z.record(impactKeySchema, impactKeySchema),
});

class AssessmentDto extends createZodDto(impactAssessmentSchema) {}
class AssessmentHistoryDto extends createZodDto(impactAssessmentHistorySchema) {}
class PrefillDto extends createZodDto(prefillSchema) {}
class SubmitAssessmentDto extends createZodDto(submitImpactAssessmentRequestSchema) {}
class ProjectIdParamsDto extends createZodDto(projectIdParamsSchema) {}

/** Self-declared impact of a project (sections 11.1 and 12), by its team. */
@ApiTags('projects')
@Controller('projects/:projectId/impact-assessments')
export class ProjectImpactController {
  constructor(private readonly impact: ProjectImpactService) {}

  @Get()
  @RequireAction('project.impact.assess', { resource: ProjectResolver })
  @ZodSerializerDto(AssessmentHistoryDto)
  @ApiOkResponse({ type: AssessmentHistoryDto.Output })
  async history(@Param() params: ProjectIdParamsDto): Promise<{ items: ImpactAssessment[] }> {
    return { items: await this.impact.history(params.projectId) };
  }

  @Get('prefill')
  @RequireAction('project.impact.assess', { resource: ProjectResolver })
  @ZodSerializerDto(PrefillDto)
  @ApiOkResponse({ type: PrefillDto.Output })
  prefill(
    @Param() params: ProjectIdParamsDto,
  ): Promise<{ methodologyId: string; answers: Record<string, string> }> {
    return this.impact.prefill(params.projectId);
  }

  @Post()
  @RequireAction('project.impact.assess', { resource: ProjectResolver })
  @Idempotent()
  @ZodSerializerDto(AssessmentDto)
  @ApiCreatedResponse({ type: AssessmentDto.Output })
  submit(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: SubmitAssessmentDto,
  ): Promise<ImpactAssessment> {
    return this.impact.submit(params.projectId, principal.userId, body);
  }
}
