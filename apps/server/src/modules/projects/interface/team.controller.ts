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
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  acceptProjectInvitationRequestSchema,
  inviteTeamMemberRequestSchema,
  projectIdParamsSchema,
  type ProjectInvitation,
  projectInvitationSchema,
  projectTeamMemberParamsSchema,
  updateTeamMemberRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { ProjectReadsService } from '../application/project-reads.service';
import { TeamService } from '../application/team.service';
import { ProjectResolver } from './project.resolver';

class InviteDto extends createZodDto(inviteTeamMemberRequestSchema) {}
class AcceptDto extends createZodDto(acceptProjectInvitationRequestSchema) {}
class UpdateMemberDto extends createZodDto(updateTeamMemberRequestSchema) {}
class InvitationsDto extends createZodDto(z.object({ items: z.array(projectInvitationSchema) })) {}
class ProjectIdParamsDto extends createZodDto(projectIdParamsSchema) {}
class MemberParamsDto extends createZodDto(projectTeamMemberParamsSchema) {}

/** Team of a project: invitations by handle, roles `owner` and `editor`, functions. */
@ApiTags('projects')
@Controller()
export class TeamController {
  constructor(
    private readonly team: TeamService,
    private readonly reads: ProjectReadsService,
  ) {}

  @Post('projects/:projectId/team/invitations')
  @RequireAction('project.team.manage', { resource: ProjectResolver })
  @Idempotent()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async invite(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: InviteDto,
  ): Promise<void> {
    await this.team.invite(params.projectId, principal.userId, body);
  }

  @Patch('projects/:projectId/team/:handle')
  @RequireAction('project.team.manage', { resource: ProjectResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async update(@Param() params: MemberParamsDto, @Body() body: UpdateMemberDto): Promise<void> {
    await this.team.update(params.projectId, params.handle, body);
  }

  /** Removes a member, or withdraws an invitation; never the last owner. */
  @Delete('projects/:projectId/team/:handle')
  @RequireAction('project.team.manage', { resource: ProjectResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberParamsDto,
  ): Promise<void> {
    await this.team.remove(params.projectId, principal.userId, params.handle);
  }

  @Post('projects/:projectId/team/leave')
  @RequireAction('project.team.leave', { resource: ProjectResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async leave(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
  ): Promise<void> {
    await this.team.leave(params.projectId, principal.userId);
  }

  @Get('me/project-invitations')
  @RequireAction('project.invitation.respond')
  @ZodSerializerDto(InvitationsDto)
  @ApiOkResponse({ type: InvitationsDto.Output })
  async invitations(
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ items: ProjectInvitation[] }> {
    return { items: await this.reads.invitations(principal.userId) };
  }

  /** Joins the team, consenting to the public display of name, photo and headline. */
  @Post('me/project-invitations/:projectId/accept')
  @RequireAction('project.invitation.respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async accept(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() _body: AcceptDto,
  ): Promise<void> {
    await this.team.accept(params.projectId, principal.userId);
  }

  @Post('me/project-invitations/:projectId/decline')
  @RequireAction('project.invitation.respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async decline(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
  ): Promise<void> {
    await this.team.decline(params.projectId, principal.userId);
  }
}
