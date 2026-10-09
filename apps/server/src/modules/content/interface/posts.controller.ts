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
import { Throttle } from '@nestjs/throttler';
import {
  createPostRequestSchema,
  createRepostRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  type FeedNewer,
  feedNewerQuerySchema,
  feedNewerSchema,
  type FeedPage,
  feedPageSchema,
  type Post,
  memberPostsParamsSchema,
  organizationPostsParamsSchema,
  postIdParamsSchema,
  postPageSchema,
  recordPostViewsRequestSchema,
  postSchema,
  type PostStats,
  postStatsSchema,
  type ReactionSummary,
  reactionSummarySchema,
  reactorPageSchema,
  reactorsQuerySchema,
  type Reactor,
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
class FeedNewerDto extends createZodDto(feedNewerSchema) {}
class FeedNewerQueryDto extends createZodDto(feedNewerQuerySchema) {}
class SavedPostPageDto extends createZodDto(savedPostPageSchema) {}
class PostStatsDto extends createZodDto(postStatsSchema) {}
class ReactionSummaryDto extends createZodDto(reactionSummarySchema) {}
class CreatePostDto extends createZodDto(createPostRequestSchema) {}
class UpdatePostDto extends createZodDto(updatePostRequestSchema) {}
class CreateRepostDto extends createZodDto(createRepostRequestSchema) {}
class SetReactionDto extends createZodDto(setReactionRequestSchema) {}
class ReactorPageDto extends createZodDto(reactorPageSchema) {}
class ReactorsQueryDto extends createZodDto(reactorsQuerySchema) {}
class PostIdParamsDto extends createZodDto(postIdParamsSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}
class PostPageDto extends createZodDto(postPageSchema) {}
class MemberPostsParamsDto extends createZodDto(memberPostsParamsSchema) {}
class OrganizationPostsParamsDto extends createZodDto(organizationPostsParamsSchema) {}
class RecordPostViewsDto extends createZodDto(recordPostViewsRequestSchema) {}

/** Signals of publications seen per member and per minute: one per screen of the feed or so. */
const VIEW_SIGNALS_PER_MINUTE = 30;

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

  /**
   * Publications of the network newer than the head of the first page (ADR 0117): a count,
   * nothing else, for the pill of the new publications.
   */
  @Get('feed/newer')
  @RequireAction('content.feed.read')
  @ZodSerializerDto(FeedNewerDto)
  @ApiOkResponse({ type: FeedNewerDto.Output })
  newer(
    @CurrentPrincipal() principal: Principal,
    @Query() query: FeedNewerQueryDto,
  ): Promise<FeedNewer> {
    return this.feed.newer(principal.userId, query.head);
  }

  @HttpPost('posts')
  @RequireAction('content.post.create')
  @Idempotent()
  @ZodSerializerDto(PostDto)
  @ApiCreatedResponse({ type: PostDto.Output })
  create(@CurrentPrincipal() principal: Principal, @Body() body: CreatePostDto): Promise<Post> {
    return this.posts.create(principal.userId, body);
  }

  /**
   * Publications seen on screen, grouped (ADR 0116): counted once per member and per day, so a
   * signal sent again changes nothing; those the member may not read are ignored.
   */
  @HttpPost('posts/views')
  @RequireAction('content.post.read')
  @Throttle({ default: { limit: VIEW_SIGNALS_PER_MINUTE, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async views(
    @CurrentPrincipal() principal: Principal,
    @Body() body: RecordPostViewsDto,
  ): Promise<void> {
    await this.posts.recordViews(principal.userId, body.postIds);
  }

  @Get('posts/:postId')
  @RequireAction('content.post.read')
  @ZodSerializerDto(PostDto)
  @ApiOkResponse({ type: PostDto.Output })
  get(@CurrentPrincipal() principal: Principal, @Param() params: PostIdParamsDto): Promise<Post> {
    return this.posts.get(principal.userId, params.postId);
  }

  /** « Activité » of a member: their publications and reposts the reader may see. */
  @Get('members/:handle/posts')
  @RequireAction('content.post.read')
  @ZodSerializerDto(PostPageDto)
  @ApiOkResponse({ type: PostPageDto.Output })
  memberPosts(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberPostsParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<Post>> {
    return this.posts.memberPosts(principal.userId, params.handle, query);
  }

  /** Without an account: the public publications of a member who keeps a public page. */
  @Get('public/members/:handle/posts')
  @Public()
  @ZodSerializerDto(PostPageDto)
  @ApiOkResponse({ type: PostPageDto.Output })
  async publicMemberPosts(
    @Param() params: MemberPostsParamsDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<Post>> {
    const page = await this.posts.memberPosts(null, params.handle, query);
    response.setHeader('Cache-Control', PUBLIC_POST_CACHE);
    return page;
  }

  /** « Activité » of an organization: its publications the reader may see. */
  @Get('organizations/by-slug/:slug/posts')
  @RequireAction('content.post.read')
  @ZodSerializerDto(PostPageDto)
  @ApiOkResponse({ type: PostPageDto.Output })
  organizationPosts(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationPostsParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<Post>> {
    return this.posts.organizationPosts(principal.userId, params.slug, query);
  }

  @Get('public/organizations/:slug/posts')
  @Public()
  @ZodSerializerDto(PostPageDto)
  @ApiOkResponse({ type: PostPageDto.Output })
  async publicOrganizationPosts(
    @Param() params: OrganizationPostsParamsDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<Post>> {
    const page = await this.posts.organizationPosts(null, params.slug, query);
    response.setHeader('Cache-Control', PUBLIC_POST_CACHE);
    return page;
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

  /** Who reacted, newest first, by reaction or all (the dialog of the reactions). */
  @Get('posts/:postId/reactions')
  @RequireAction('content.post.read')
  @ZodSerializerDto(ReactorPageDto)
  @ApiOkResponse({ type: ReactorPageDto.Output })
  reactors(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
    @Query() query: ReactorsQueryDto,
  ): Promise<CursorPage<Reactor>> {
    return this.reactions.reactors(principal.userId, params.postId, query.type ?? null, query);
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
  /** Daily unique viewers (approximate), for the author only. */
  @Get('posts/:postId/stats')
  @RequireAction('content.post.stats.read', { resource: PostResolver })
  @ZodSerializerDto(PostStatsDto)
  @ApiOkResponse({ type: PostStatsDto.Output })
  stats(@Param() params: PostIdParamsDto): Promise<PostStats> {
    return this.posts.stats(params.postId);
  }
}
