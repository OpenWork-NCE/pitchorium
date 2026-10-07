import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type CursorPage,
  cursorPageQuerySchema,
  expressInterestRequestSchema,
  projectIdParamsSchema,
  type ProjectInterest,
  projectInterestPageSchema,
  projectInterestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { InterestsService } from '../application/interests.service';
import { ProjectReadsService } from '../application/project-reads.service';
import { ProjectResolver } from './project.resolver';

class InterestDto extends createZodDto(projectInterestSchema) {}
class InterestPageDto extends createZodDto(projectInterestPageSchema) {}
class ExpressInterestDto extends createZodDto(expressInterestRequestSchema) {}
class ProjectIdParamsDto extends createZodDto(projectIdParamsSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}

/** Expressions of interest (sections 9.1 and 11.2): no payment, read by the team. */
@ApiTags('projects')
@Controller('projects/:projectId/interests')
export class InterestsController {
  constructor(
    private readonly interests: InterestsService,
    private readonly reads: ProjectReadsService,
  ) {}

  @Post()
  @RequireAction('project.interest.express', { resource: ProjectResolver })
  @Idempotent()
  @ZodSerializerDto(InterestDto)
  @ApiCreatedResponse({ type: InterestDto.Output })
  async express(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: ExpressInterestDto,
  ): Promise<ProjectInterest> {
    return this.reads.presentInterest(
      await this.interests.express(params.projectId, principal.userId, body),
    );
  }

  @Get()
  @RequireAction('project.interest.read', { resource: ProjectResolver })
  @ZodSerializerDto(InterestPageDto)
  @ApiOkResponse({ type: InterestPageDto.Output })
  list(
    @Param() params: ProjectIdParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<ProjectInterest>> {
    return this.reads.interests(params.projectId, query);
  }
}
