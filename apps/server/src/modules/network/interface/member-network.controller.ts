import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type Connection,
  connectionPageSchema,
  type CursorPage,
  cursorPageQuerySchema,
  type Follow,
  type Follower,
  followerPageSchema,
  followingQuerySchema,
  followPageSchema,
  memberHandleParamsSchema,
  type Relationship,
  relationshipSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { NetworkReadsService } from '../application/network-reads.service';

class FollowerPageDto extends createZodDto(followerPageSchema) {}
class FollowPageDto extends createZodDto(followPageSchema) {}
class ConnectionPageDto extends createZodDto(connectionPageSchema) {}
class RelationshipDto extends createZodDto(relationshipSchema) {}
class MemberHandleParamsDto extends createZodDto(memberHandleParamsSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}
class FollowingQueryDto extends createZodDto(
  cursorPageQuerySchema.extend(followingQuerySchema.shape),
) {}

/** Short shared cache, as for the public profile: hiding a list must take effect quickly. */
const PUBLIC_LIST_CACHE = 'public, max-age=60';

/**
 * Network lists of a member (followers, following, connections) and the relationship with the
 * viewer. Lists follow the visibility set in the profile (ADR 0017).
 */
@ApiTags('network')
@Controller()
export class MemberNetworkController {
  constructor(private readonly reads: NetworkReadsService) {}

  @Get('network/members/:handle/followers')
  @RequireAction('network.read')
  @ZodSerializerDto(FollowerPageDto)
  @ApiOkResponse({ type: FollowerPageDto.Output })
  followers(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberHandleParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<Follower>> {
    return this.reads.followersOfMember({ viewerId: principal.userId }, params.handle, query);
  }

  @Get('network/members/:handle/following')
  @RequireAction('network.read')
  @ZodSerializerDto(FollowPageDto)
  @ApiOkResponse({ type: FollowPageDto.Output })
  following(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberHandleParamsDto,
    @Query() query: FollowingQueryDto,
  ): Promise<CursorPage<Follow>> {
    return this.reads.followingOfMember(
      { viewerId: principal.userId },
      params.handle,
      query.type,
      query,
    );
  }

  @Get('network/members/:handle/connections')
  @RequireAction('network.read')
  @ZodSerializerDto(ConnectionPageDto)
  @ApiOkResponse({ type: ConnectionPageDto.Output })
  connections(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberHandleParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<Connection>> {
    return this.reads.connectionsOfMember({ viewerId: principal.userId }, params.handle, query);
  }

  /** Degree, mutual connections, connection state, follows and block, from the viewer side. */
  @Get('network/members/:handle/relationship')
  @RequireAction('network.read')
  @ZodSerializerDto(RelationshipDto)
  @ApiOkResponse({ type: RelationshipDto.Output })
  relationship(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberHandleParamsDto,
  ): Promise<Relationship> {
    return this.reads.relationship(principal.userId, params.handle);
  }

  /** Without an account: lists set to `public` on a profile with a public page, 404 otherwise. */
  @Get('public/network/members/:handle/followers')
  @Public()
  @ZodSerializerDto(FollowerPageDto)
  @ApiOkResponse({ type: FollowerPageDto.Output })
  publicFollowers(
    @Param() params: MemberHandleParamsDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<Follower>> {
    response.setHeader('Cache-Control', PUBLIC_LIST_CACHE);
    return this.reads.followersOfMember({ viewerId: null }, params.handle, query);
  }

  @Get('public/network/members/:handle/following')
  @Public()
  @ZodSerializerDto(FollowPageDto)
  @ApiOkResponse({ type: FollowPageDto.Output })
  publicFollowing(
    @Param() params: MemberHandleParamsDto,
    @Query() query: FollowingQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<Follow>> {
    response.setHeader('Cache-Control', PUBLIC_LIST_CACHE);
    return this.reads.followingOfMember({ viewerId: null }, params.handle, query.type, query);
  }

  @Get('public/network/members/:handle/connections')
  @Public()
  @ZodSerializerDto(ConnectionPageDto)
  @ApiOkResponse({ type: ConnectionPageDto.Output })
  publicConnections(
    @Param() params: MemberHandleParamsDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<Connection>> {
    response.setHeader('Cache-Control', PUBLIC_LIST_CACHE);
    return this.reads.connectionsOfMember({ viewerId: null }, params.handle, query);
  }
}
