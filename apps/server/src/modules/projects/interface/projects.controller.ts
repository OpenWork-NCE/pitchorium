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
import {
  ApiCreatedResponse,
  ApiMovedPermanentlyResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  changeProjectSlugRequestSchema,
  createProjectRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  type MyProject,
  myProjectSchema,
  type Post as PostView,
  postPageSchema,
  type Project,
  type ProjectCard,
  projectCardPageSchema,
  projectIdParamsSchema,
  projectSchema,
  projectShowcaseQuerySchema,
  projectSlugParamsSchema,
  publishProjectRequestSchema,
  replaceTiersRequestSchema,
  setProjectDocumentsRequestSchema,
  setProjectGalleryRequestSchema,
  updateProjectRequestSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { ContentFacade } from '../../content';
import { type ProjectLookup, ProjectReadsService } from '../application/project-reads.service';
import { ProjectsService } from '../application/projects.service';
import { ProjectResolver } from './project.resolver';

class ProjectDto extends createZodDto(projectSchema) {}
class ProjectCardPageDto extends createZodDto(projectCardPageSchema) {}
class MyProjectsDto extends createZodDto(z.object({ items: z.array(myProjectSchema) })) {}
class PostPageDto extends createZodDto(postPageSchema) {}
class CreateProjectDto extends createZodDto(createProjectRequestSchema) {}
class UpdateProjectDto extends createZodDto(updateProjectRequestSchema) {}
class ChangeProjectSlugDto extends createZodDto(changeProjectSlugRequestSchema) {}
class ReplaceTiersDto extends createZodDto(replaceTiersRequestSchema) {}
class SetGalleryDto extends createZodDto(setProjectGalleryRequestSchema) {}
class SetDocumentsDto extends createZodDto(setProjectDocumentsRequestSchema) {}
class PublishDto extends createZodDto(publishProjectRequestSchema) {}
class ShowcaseQueryDto extends createZodDto(projectShowcaseQuerySchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}
class ProjectIdParamsDto extends createZodDto(projectIdParamsSchema) {}
class ProjectSlugParamsDto extends createZodDto(projectSlugParamsSchema) {}

/** Short shared cache: a change of the page, or its withdrawal, must show quickly. */
const PUBLIC_PROJECT_CACHE = 'public, max-age=60';

function reply(response: Response, lookup: ProjectLookup, basePath: string): void {
  if (lookup.kind === 'moved') {
    response.redirect(HttpStatus.MOVED_PERMANENTLY, `${basePath}/${lookup.slug}`);
    return;
  }
  response.json(projectSchema.parse(lookup.view));
}

/** Projects and campaigns (section 11): drafts, page, showcase, publication. */
@ApiTags('projects')
@Controller()
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly reads: ProjectReadsService,
    private readonly content: ContentFacade,
  ) {}

  @Post('projects')
  @RequireAction('project.create')
  @Idempotent()
  @ZodSerializerDto(ProjectDto)
  @ApiCreatedResponse({ type: ProjectDto.Output })
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateProjectDto,
  ): Promise<Project> {
    const project = await this.projects.create(principal.userId, body);
    return this.reads.byId(project.id, principal.userId);
  }

  /** Projects in whose team the member is active, drafts included, with their role. */
  @Get('me/projects')
  @RequireAction('project.read')
  @ZodSerializerDto(MyProjectsDto)
  @ApiOkResponse({ type: MyProjectsDto.Output })
  async mine(@CurrentPrincipal() principal: Principal): Promise<{ items: MyProject[] }> {
    return { items: await this.reads.mine(principal.userId) };
  }

  /** Showcase: published projects, filters, sorted by publication or by end date. */
  @Get('projects')
  @RequireAction('project.read')
  @ZodSerializerDto(ProjectCardPageDto)
  @ApiOkResponse({ type: ProjectCardPageDto.Output })
  showcase(@Query() query: ShowcaseQueryDto): Promise<CursorPage<ProjectCard>> {
    return this.reads.showcase(query);
  }

  @Get('public/projects')
  @Public()
  @ZodSerializerDto(ProjectCardPageDto)
  @ApiOkResponse({ type: ProjectCardPageDto.Output })
  async publicShowcase(
    @Query() query: ShowcaseQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<ProjectCard>> {
    const page = await this.reads.showcase(query);
    response.setHeader('Cache-Control', PUBLIC_PROJECT_CACHE);
    return page;
  }

  /** Member view, with the reader's state; the team also reads its drafts. */
  @Get('projects/by-slug/:slug')
  @RequireAction('project.read')
  @ApiOkResponse({ type: ProjectDto.Output })
  @ApiMovedPermanentlyResponse({ description: 'Former slug: Location gives the current one.' })
  async forMember(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectSlugParamsDto,
    @Res() response: Response,
  ): Promise<void> {
    const lookup = await this.reads.bySlug(params.slug, {
      kind: 'member',
      viewerId: principal.userId,
    });
    reply(response, lookup, '/v1/projects/by-slug');
  }

  /** Public page, without session: every block of section 11.2. Cacheable by shared caches. */
  @Get('public/projects/:slug')
  @Public()
  @ApiOkResponse({ type: ProjectDto.Output })
  @ApiMovedPermanentlyResponse({ description: 'Former slug: Location gives the current one.' })
  async forPublic(@Param() params: ProjectSlugParamsDto, @Res() response: Response): Promise<void> {
    const lookup = await this.reads.bySlug(params.slug, { kind: 'public' });
    response.setHeader('Cache-Control', PUBLIC_PROJECT_CACHE);
    reply(response, lookup, '/v1/public/projects');
  }

  @Get('public/projects/:projectId/posts')
  @Public()
  @ZodSerializerDto(PostPageDto)
  @ApiOkResponse({ type: PostPageDto.Output })
  async publicPosts(
    @Param() params: ProjectIdParamsDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<PostView>> {
    await this.reads.requireShowable(params.projectId);
    response.setHeader('Cache-Control', PUBLIC_PROJECT_CACHE);
    return this.content.projectPosts(params.projectId, null, query);
  }

  /** The page with the management data for its team (`management`). */
  @Get('projects/:projectId')
  @RequireAction('project.read', { resource: ProjectResolver })
  @ZodSerializerDto(ProjectDto)
  @ApiOkResponse({ type: ProjectDto.Output })
  get(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
  ): Promise<Project> {
    return this.reads.byId(params.projectId, principal.userId);
  }

  /** The public page as visitors will see it, before publication (section 11.1): team only. */
  @Get('projects/:projectId/preview')
  @RequireAction('project.update', { resource: ProjectResolver })
  @ZodSerializerDto(ProjectDto)
  @ApiOkResponse({ type: ProjectDto.Output })
  preview(@Param() params: ProjectIdParamsDto): Promise<Project> {
    return this.reads.preview(params.projectId);
  }

  /** Publications attached to the project (section 10.3), as the reader may see them. */
  @Get('projects/:projectId/posts')
  @RequireAction('project.read', { resource: ProjectResolver })
  @ZodSerializerDto(PostPageDto)
  @ApiOkResponse({ type: PostPageDto.Output })
  posts(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<PostView>> {
    return this.content.projectPosts(params.projectId, principal.userId, query);
  }

  @Patch('projects/:projectId')
  @RequireAction('project.update', { resource: ProjectResolver })
  @ZodSerializerDto(ProjectDto)
  @ApiOkResponse({ type: ProjectDto.Output })
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: UpdateProjectDto,
  ): Promise<Project> {
    await this.projects.update(params.projectId, principal.userId, body);
    return this.reads.byId(params.projectId, principal.userId);
  }

  @Put('projects/:projectId/slug')
  @RequireAction('project.update', { resource: ProjectResolver })
  @ZodSerializerDto(ProjectDto)
  @ApiOkResponse({ type: ProjectDto.Output })
  async changeSlug(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: ChangeProjectSlugDto,
  ): Promise<Project> {
    await this.projects.changeSlug(params.projectId, principal.userId, body.slug);
    return this.reads.byId(params.projectId, principal.userId);
  }

  /** Replaces the tiers; the last threshold becomes the goal (ADR 0038). */
  @Put('projects/:projectId/tiers')
  @RequireAction('project.update', { resource: ProjectResolver })
  @ZodSerializerDto(ProjectDto)
  @ApiOkResponse({ type: ProjectDto.Output })
  async replaceTiers(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: ReplaceTiersDto,
  ): Promise<Project> {
    await this.projects.replaceTiers(params.projectId, principal.userId, body.tiers);
    return this.reads.byId(params.projectId, principal.userId);
  }

  /** Gallery: ready images of usage `project_gallery`, the first one is the cover. */
  @Put('projects/:projectId/gallery')
  @RequireAction('project.update', { resource: ProjectResolver })
  @ZodSerializerDto(ProjectDto)
  @ApiOkResponse({ type: ProjectDto.Output })
  async setGallery(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: SetGalleryDto,
  ): Promise<Project> {
    await this.projects.setGallery(params.projectId, principal.userId, body.mediaIds);
    return this.reads.byId(params.projectId, principal.userId);
  }

  /** Private documents: ready PDF files of usage `project_document`. */
  @Put('projects/:projectId/documents')
  @RequireAction('project.update', { resource: ProjectResolver })
  @ZodSerializerDto(ProjectDto)
  @ApiOkResponse({ type: ProjectDto.Output })
  async setDocuments(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: SetDocumentsDto,
  ): Promise<Project> {
    await this.projects.setDocuments(params.projectId, principal.userId, body.mediaIds);
    return this.reads.byId(params.projectId, principal.userId);
  }

  /** Draft to funding, with the consent of the owner to the public display of the team. */
  @Post('projects/:projectId/publish')
  @RequireAction('project.publish', { resource: ProjectResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ProjectDto)
  @ApiOkResponse({ type: ProjectDto.Output })
  async publish(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: PublishDto,
  ): Promise<Project> {
    await this.projects.publish(params.projectId, principal.userId, body.publicDisplayConsent);
    return this.reads.byId(params.projectId, principal.userId);
  }

  /** Only a draft can be deleted. */
  @Delete('projects/:projectId')
  @RequireAction('project.delete', { resource: ProjectResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
  ): Promise<void> {
    await this.projects.delete(params.projectId, principal.userId);
  }

  /** Editorial highlight of the showcase (moderator or administrator, audited). */
}
