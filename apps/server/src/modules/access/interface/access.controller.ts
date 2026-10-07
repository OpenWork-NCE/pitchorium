import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type ActionPrerequisites,
  actionPrerequisitesSchema,
  actionSchema,
  assignableRoleSchema,
  grantRoleRequestSchema,
  type UserRoles,
  userRolesSchema,
  uuidV7Schema,
} from '@pitchorium/contracts';
import type { Request } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { AccessService } from '../application/access.service';
import { RoleService } from '../application/role.service';
import type { Actor } from '../domain/actor';
import { CurrentActor } from './current-actor.decorator';

class ActionPrerequisitesDto extends createZodDto(actionPrerequisitesSchema) {}
class ActionParamsDto extends createZodDto(z.object({ action: actionSchema })) {}
class UserParamsDto extends createZodDto(z.object({ userId: uuidV7Schema })) {}
class UserRoleParamsDto extends createZodDto(
  z.object({ userId: uuidV7Schema, role: assignableRoleSchema }),
) {}
class GrantRoleRequestDto extends createZodDto(grantRoleRequestSchema) {}
class UserRolesDto extends createZodDto(userRolesSchema) {}

const requestIdOf = (request: Request) => (typeof request.id === 'string' ? request.id : undefined);

@ApiTags('access')
@Controller()
export class AccessController {
  constructor(
    private readonly access: AccessService,
    private readonly roles: RoleService,
  ) {}

  /** What the current member must complete before performing an action. */
  @Get('me/prerequisites/:action')
  @RequireAction('account.read')
  @ZodSerializerDto(ActionPrerequisitesDto)
  @ApiOkResponse({ type: ActionPrerequisitesDto.Output })
  prerequisites(
    @CurrentActor() actor: Actor,
    @Param() params: ActionParamsDto,
  ): Promise<ActionPrerequisites> {
    return this.access.prerequisitesOf(actor, params.action);
  }

  @Get('access/users/:userId/roles')
  @RequireAction('access.roles.read')
  @ZodSerializerDto(UserRolesDto)
  @ApiOkResponse({ type: UserRolesDto.Output })
  listRoles(@Param() params: UserParamsDto): Promise<UserRoles> {
    return this.roles.list(params.userId);
  }

  @Post('access/users/:userId/roles')
  @RequireAction('access.roles.manage')
  @Idempotent()
  @ZodSerializerDto(UserRolesDto)
  @ApiOkResponse({ type: UserRolesDto.Output })
  grantRole(
    @CurrentActor() actor: Actor,
    @Param() params: UserParamsDto,
    @Body() body: GrantRoleRequestDto,
    @Req() request: Request,
  ): Promise<UserRoles> {
    const requestId = requestIdOf(request);
    return this.roles.grant(params.userId, body.role, {
      actorId: actor.userId,
      ...(requestId ? { requestId } : {}),
    });
  }

  @Delete('access/users/:userId/roles/:role')
  @RequireAction('access.roles.manage')
  @ZodSerializerDto(UserRolesDto)
  @ApiOkResponse({ type: UserRolesDto.Output })
  revokeRole(
    @CurrentActor() actor: Actor,
    @Param() params: UserRoleParamsDto,
    @Req() request: Request,
  ): Promise<UserRoles> {
    const requestId = requestIdOf(request);
    return this.roles.revoke(params.userId, params.role, {
      actorId: actor.userId,
      ...(requestId ? { requestId } : {}),
    });
  }
}
