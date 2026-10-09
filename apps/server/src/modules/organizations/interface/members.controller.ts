import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  changeMemberRoleRequestSchema,
  type Organization,
  organizationIdParamsSchema,
  organizationMemberParamsSchema,
  organizationSchema,
  transferOwnershipRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { MembersService } from '../application/members.service';
import { OrganizationReadsService } from '../application/organization-reads.service';
import { OrganizationResolver } from './organization.resolver';

class OrganizationDto extends createZodDto(organizationSchema) {}
class ChangeRoleDto extends createZodDto(changeMemberRoleRequestSchema) {}
class TransferOwnershipDto extends createZodDto(transferOwnershipRequestSchema) {}
class OrganizationIdParamsDto extends createZodDto(organizationIdParamsSchema) {}
class OrganizationMemberParamsDto extends createZodDto(organizationMemberParamsSchema) {}

/** Internal roles: owners manage everyone, admins manage admins and members. */
@ApiTags('organizations')
@Controller('organizations/:organizationId')
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly reads: OrganizationReadsService,
  ) {}

  @Patch('members/:handle')
  @RequireAction('organization.member.manage', { resource: OrganizationResolver })
  @ZodSerializerDto(OrganizationDto)
  @ApiOkResponse({ type: OrganizationDto.Output })
  async changeRole(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationMemberParamsDto,
    @Body() body: ChangeRoleDto,
  ): Promise<Organization> {
    await this.members.changeRole(
      params.organizationId,
      principal.userId,
      await this.members.userIdByHandle(params.handle),
      body.role,
    );
    return this.reads.byId(params.organizationId, principal.userId);
  }

  @Delete('members/:handle')
  @RequireAction('organization.member.manage', { resource: OrganizationResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationMemberParamsDto,
  ): Promise<void> {
    await this.members.remove(
      params.organizationId,
      principal.userId,
      await this.members.userIdByHandle(params.handle),
    );
  }

  /** The last owner cannot leave: ownership must be transferred first. */
  @Post('leave')
  @RequireAction('organization.member.leave', { resource: OrganizationResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async leave(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
  ): Promise<void> {
    await this.members.leave(params.organizationId, principal.userId);
  }

  /** Gives ownership to another member; the previous owner stays as an admin. */
  @Post('ownership-transfer')
  @RequireAction('organization.ownership.transfer', { resource: OrganizationResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(OrganizationDto)
  @ApiOkResponse({ type: OrganizationDto.Output })
  async transfer(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
    @Body() body: TransferOwnershipDto,
  ): Promise<Organization> {
    await this.members.transferOwnership(
      params.organizationId,
      principal.userId,
      await this.members.userIdByHandle(body.handle),
    );
    return this.reads.byId(params.organizationId, principal.userId);
  }
}
