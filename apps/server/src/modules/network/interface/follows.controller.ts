import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Query } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  cursorPageQuerySchema,
  type CursorPage,
  type Follow,
  type Follower,
  followerPageSchema,
  followSchema,
  type FollowState,
  followStateSchema,
  followTargetParamsSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { FollowsService } from '../application/follows.service';
import { NetworkReadsService } from '../application/network-reads.service';

class FollowDto extends createZodDto(followSchema) {}
class FollowStateDto extends createZodDto(followStateSchema) {}
class FollowerPageDto extends createZodDto(followerPageSchema) {}
class FollowTargetParamsDto extends createZodDto(followTargetParamsSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}

/**
 * Follows of any registered target (§10.2, ADR 0027): `member/{handle}`,
 * `organization/{organizationId}`, and the types other modules register.
 */
@ApiTags('network')
@Controller('network/follows')
export class FollowsController {
  constructor(
    private readonly follows: FollowsService,
    private readonly reads: NetworkReadsService,
  ) {}

  /** Whether the reader follows the target, and its number of followers (not for a member). */
  @Get(':targetType/:targetKey')
  @RequireAction('network.read')
  @ZodSerializerDto(FollowStateDto)
  @ApiOkResponse({ type: FollowStateDto.Output })
  state(
    @CurrentPrincipal() principal: Principal,
    @Param() params: FollowTargetParamsDto,
  ): Promise<FollowState> {
    return this.follows.state(principal.userId, params.targetType, params.targetKey);
  }

  @Put(':targetType/:targetKey')
  @RequireAction('network.follow')
  @ZodSerializerDto(FollowDto)
  @ApiOkResponse({ type: FollowDto.Output })
  follow(
    @CurrentPrincipal() principal: Principal,
    @Param() params: FollowTargetParamsDto,
  ): Promise<Follow> {
    return this.follows.follow(principal.userId, params.targetType, params.targetKey);
  }

  @Delete(':targetType/:targetKey')
  @RequireAction('network.follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async unfollow(
    @CurrentPrincipal() principal: Principal,
    @Param() params: FollowTargetParamsDto,
  ): Promise<void> {
    await this.follows.unfollow(principal.userId, params.targetType, params.targetKey);
  }

  /** Followers of a target; those of a member follow the visibility of their lists. */
  @Get(':targetType/:targetKey/followers')
  @RequireAction('network.read')
  @ZodSerializerDto(FollowerPageDto)
  @ApiOkResponse({ type: FollowerPageDto.Output })
  followers(
    @CurrentPrincipal() principal: Principal,
    @Param() params: FollowTargetParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<Follower>> {
    return this.reads.followersOfTarget(
      principal.userId,
      params.targetType,
      params.targetKey,
      query,
    );
  }
}
