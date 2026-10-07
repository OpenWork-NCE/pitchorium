import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type ImpactAssessment,
  impactAssessmentHistorySchema,
  impactAssessmentSchema,
  submitImpactAssessmentRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { AssessmentsService } from '../application/assessments.service';

class AssessmentDto extends createZodDto(impactAssessmentSchema) {}
class AssessmentHistoryDto extends createZodDto(impactAssessmentHistorySchema) {}
class SubmitAssessmentDto extends createZodDto(submitImpactAssessmentRequestSchema) {}

/** Self-declared assessment of the entrepreneur facet of the signed-in member (section 12). */
@ApiTags('impact')
@Controller('me/impact/assessments')
export class MyAssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  /** History, newest first: the first item is the current assessment. */
  @Get()
  @RequireAction('impact.assessment.read')
  @ZodSerializerDto(AssessmentHistoryDto)
  @ApiOkResponse({ type: AssessmentHistoryDto.Output })
  async history(@CurrentPrincipal() principal: Principal): Promise<{ items: ImpactAssessment[] }> {
    return {
      items: await this.assessments.history({ type: 'entrepreneur_facet', id: principal.userId }),
    };
  }

  @Post()
  @RequireAction('impact.assessment.submit')
  @Idempotent()
  @ZodSerializerDto(AssessmentDto)
  @ApiCreatedResponse({ type: AssessmentDto.Output })
  submit(
    @CurrentPrincipal() principal: Principal,
    @Body() body: SubmitAssessmentDto,
  ): Promise<ImpactAssessment> {
    return this.assessments.submit({
      subject: { type: 'entrepreneur_facet', id: principal.userId },
      submittedBy: principal.userId,
      methodologyId: body.methodologyId,
      answers: body.answers,
    });
  }
}
