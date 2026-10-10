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
  Query,
  Res,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  createProjectUpdateRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  editProjectUpdateRequestSchema,
  projectIdParamsSchema,
  type ProjectUpdate,
  projectUpdatePageSchema,
  projectUpdateParamsSchema,
  projectUpdateSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { ProjectReadsService } from '../application/project-reads.service';
import { UpdatesService } from '../application/updates.service';
import { ProjectResolver } from './project.resolver';

class UpdateDto extends createZodDto(projectUpdateSchema) {}
class UpdatePageDto extends createZodDto(projectUpdatePageSchema) {}
class CreateUpdateDto extends createZodDto(createProjectUpdateRequestSchema) {}
class EditUpdateDto extends createZodDto(editProjectUpdateRequestSchema) {}
class ProjectIdParamsDto extends createZodDto(projectIdParamsSchema) {}
class UpdateParamsDto extends createZodDto(projectUpdateParamsSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}

const PUBLIC_UPDATES_CACHE = 'public, max-age=60';

/** Campaign updates (section 11.3), shown on the page and in the feed of the followers. */
@ApiTags('projects')
@Controller()
export class UpdatesController {
  constructor(
    private readonly updates: UpdatesService,
    private readonly reads: ProjectReadsService,
  ) {}

  @Post('projects/:projectId/updates')
  @RequireAction('project.updates.publish', { resource: ProjectResolver })
  @Idempotent()
  @ZodSerializerDto(UpdateDto)
  @ApiCreatedResponse({ type: UpdateDto.Output })
  async publish(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: CreateUpdateDto,
  ): Promise<ProjectUpdate> {
    return this.reads.presentUpdate(
      await this.updates.publish(params.projectId, principal.userId, body),
    );
  }

  @Get('projects/:projectId/updates')
  @RequireAction('project.read', { resource: ProjectResolver })
  @ZodSerializerDto(UpdatePageDto)
  @ApiOkResponse({ type: UpdatePageDto.Output })
  list(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<ProjectUpdate>> {
    return this.reads.updates(
      params.projectId,
      { kind: 'member', viewerId: principal.userId },
      query,
    );
  }

  @Get('public/projects/:projectId/updates')
  @Public()
  @ZodSerializerDto(UpdatePageDto)
  @ApiOkResponse({ type: UpdatePageDto.Output })
  async publicList(
    @Param() params: ProjectIdParamsDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<ProjectUpdate>> {
    const page = await this.reads.updates(params.projectId, { kind: 'public' }, query);
    response.setHeader('Cache-Control', PUBLIC_UPDATES_CACHE);
    return page;
  }

  @Patch('projects/:projectId/updates/:updateId')
  @RequireAction('project.updates.publish', { resource: ProjectResolver })
  @ZodSerializerDto(UpdateDto)
  @ApiOkResponse({ type: UpdateDto.Output })
  async edit(
    @Param() params: UpdateParamsDto,
    @Body() body: EditUpdateDto,
  ): Promise<ProjectUpdate> {
    return this.reads.presentUpdate(
      await this.updates.edit(params.projectId, params.updateId, body),
    );
  }

  @Delete('projects/:projectId/updates/:updateId')
  @RequireAction('project.updates.publish', { resource: ProjectResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(@Param() params: UpdateParamsDto): Promise<void> {
    await this.updates.delete(params.projectId, params.updateId);
  }
}
