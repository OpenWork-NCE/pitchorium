import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post as HttpPost,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  createPostRequestSchema,
  createRepostRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  type FeedPage,
  feedPageSchema,
  type Post,
  postIdParamsSchema,
  postSchema,
  type PostStats,
  postStatsSchema,
  type ReactionSummary,
  reactionSummarySchema,
  type SavedPost,
  savedPostPageSchema,
  setReactionRequestSchema,
  updatePostRequestSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { FeedService } from '../application/feed.service';
import { PostsService } from '../application/posts.service';
import { ReactionsService } from '../application/reactions.service';
import { PostResolver } from './content.resolvers';

class PostDto extends createZodDto(postSchema) {}
class FeedPageDto extends createZodDto(feedPageSchema) {}
class SavedPostPageDto extends createZodDto(savedPostPageSchema) {}
class PostStatsDto extends createZodDto(postStatsSchema) {}
class ReactionSummaryDto extends createZodDto(reactionSummarySchema) {}
class CreatePostDto extends createZodDto(createPostRequestSchema) {}
class UpdatePostDto extends createZodDto(updatePostRequestSchema) {}
class CreateRepostDto extends createZodDto(createRepostRequestSchema) {}
class SetReactionDto extends createZodDto(setReactionRequestSchema) {}
class PostIdParamsDto extends createZodDto(postIdParamsSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}

/** Short shared cache: a deletion or a change of visibility must take effect quickly. */
const PUBLIC_POST_CACHE = 'public, max-age=60';

/** Feed, publications, reposts, reactions, saving and hiding (§10.3). */
@ApiTags('content')
@Controller()
export class PostsController {
  constructor(
    private readonly feed: FeedService,
    private readonly posts: PostsService,
    private readonly reactions: ReactionsService,
  ) {}

  /** Feed of the member: network first, editorial highlights when it produces too little. */
  @Get('feed')
  @RequireAction('content.feed.read')
  @ZodSerializerDto(FeedPageDto)
  @ApiOkResponse({ type: FeedPageDto.Output })
  read(@CurrentPrincipal() principal: Principal, @Query() query: PageQueryDto): Promise<FeedPage> {
    return this.feed.feed(principal.userId, query);
  }

  @HttpPost('posts')
  @RequireAction('content.post.create')
  @Idempotent()
  @ZodSerializerDto(PostDto)
  @ApiCreatedResponse({ type: PostDto.Output })
  create(@CurrentPrincipal() principal: Principal, @Body() body: CreatePostDto): Promise<Post> {
    return this.posts.create(principal.userId, body);
  }

  @Get('posts/:postId')
  @RequireAction('content.post.read')
  @ZodSerializerDto(PostDto)
  @ApiOkResponse({ type: PostDto.Output })
  get(@CurrentPrincipal() principal: Principal, @Param() params: PostIdParamsDto): Promise<Post> {
    return this.posts.get(principal.userId, params.postId);
  }

  /** Without an account: a public publication whose author keeps a public page. */
  @Get('public/posts/:postId')
  @Public()
  @ZodSerializerDto(PostDto)
  @ApiOkResponse({ type: PostDto.Output })
  async getPublic(
    @Param() params: PostIdParamsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Post> {
    const post = await this.posts.getPublic(params.postId);
    response.setHeader('Cache-Control', PUBLIC_POST_CACHE);
    return post;
  }

  @Patch('posts/:postId')
  @RequireAction('content.post.update', { resource: PostResolver })
  @ZodSerializerDto(PostDto)
  @ApiOkResponse({ type: PostDto.Output })
  update(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
    @Body() body: UpdatePostDto,
  ): Promise<Post> {
    return this.posts.update(principal.userId, params.postId, body);
  }

  @Delete('posts/:postId')
  @RequireAction('content.post.delete', { resource: PostResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
  ): Promise<void> {
    await this.posts.delete(principal.userId, params.postId);
  }

  /** Reposts the publication (its original for a repost), never outside of its audience. */
  @HttpPost('posts/:postId/reposts')
  @RequireAction('content.post.repost')
  @Idempotent()
  @ZodSerializerDto(PostDto)
  @ApiCreatedResponse({ type: PostDto.Output })
  repost(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
    @Body() body: CreateRepostDto,
  ): Promise<Post> {
    return this.posts.repost(principal.userId, params.postId, body);
  }

  @Put('posts/:postId/reaction')
  @RequireAction('content.reaction.set')
  @ZodSerializerDto(ReactionSummaryDto)
  @ApiOkResponse({ type: ReactionSummaryDto.Output })
  react(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
    @Body() body: SetReactionDto,
  ): Promise<ReactionSummary> {
    return this.reactions.react(principal.userId, { type: 'post', id: params.postId }, body.type);
  }

  @Delete('posts/:postId/reaction')
  @RequireAction('content.reaction.set')
  @ZodSerializerDto(ReactionSummaryDto)
  @ApiOkResponse({ type: ReactionSummaryDto.Output })
  unreact(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
  ): Promise<ReactionSummary> {
    return this.reactions.react(principal.userId, { type: 'post', id: params.postId }, null);
  }

  @Put('posts/:postId/save')
  @RequireAction('content.post.save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async save(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
  ): Promise<void> {
    await this.posts.save(principal.userId, params.postId, true);
  }

  @Delete('posts/:postId/save')
  @RequireAction('content.post.save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async unsave(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
  ): Promise<void> {
    await this.posts.save(principal.userId, params.postId, false);
  }

  @Get('me/saved-posts')
  @RequireAction('content.post.save')
  @ZodSerializerDto(SavedPostPageDto)
  @ApiOkResponse({ type: SavedPostPageDto.Output })
  saved(
    @CurrentPrincipal() principal: Principal,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<SavedPost>> {
    return this.posts.savedPosts(principal.userId, query);
  }

  /** Hides the publication from the member's own feed. */
  @Put('posts/:postId/hide')
  @RequireAction('content.post.hide')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async hide(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
  ): Promise<void> {
    await this.posts.hide(principal.userId, params.postId, true);
  }

  @Delete('posts/:postId/hide')
  @RequireAction('content.post.hide')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async unhide(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
  ): Promise<void> {
    await this.posts.hide(principal.userId, params.postId, false);
  }

  /** Editorial highlight (moderators and administrators with 2FA). */
  @Put('posts/:postId/feature')
  @RequireAction('content.post.feature')
  @ZodSerializerDto(PostDto)
  @ApiOkResponse({ type: PostDto.Output })
  feature(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
  ): Promise<Post> {
    return this.posts.setFeatured(principal.userId, params.postId, true);
  }

  @Delete('posts/:postId/feature')
  @RequireAction('content.post.feature')
  @ZodSerializerDto(PostDto)
  @ApiOkResponse({ type: PostDto.Output })
  unfeature(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
  ): Promise<Post> {
    return this.posts.setFeatured(principal.userId, params.postId, false);
  }

  /** Daily unique viewers (approximate), for the author only. */
  @Get('posts/:postId/stats')
  @RequireAction('content.post.stats.read', { resource: PostResolver })
  @ZodSerializerDto(PostStatsDto)
  @ApiOkResponse({ type: PostStatsDto.Output })
  stats(@Param() params: PostIdParamsDto): Promise<PostStats> {
    return this.posts.stats(params.postId);
  }
}
