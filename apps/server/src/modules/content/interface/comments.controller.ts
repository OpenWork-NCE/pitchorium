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
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type Comment,
  commentIdParamsSchema,
  commentPageSchema,
  commentSchema,
  createCommentRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  postIdParamsSchema,
  type ReactionSummary,
  reactionSummarySchema,
  setReactionRequestSchema,
  updateCommentRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { CommentsService } from '../application/comments.service';
import { ReactionsService } from '../application/reactions.service';
import { CommentResolver } from './content.resolvers';

class CommentDto extends createZodDto(commentSchema) {}
class CommentPageDto extends createZodDto(commentPageSchema) {}
class CreateCommentDto extends createZodDto(createCommentRequestSchema) {}
class UpdateCommentDto extends createZodDto(updateCommentRequestSchema) {}
class ReactionSummaryDto extends createZodDto(reactionSummarySchema) {}
class SetReactionDto extends createZodDto(setReactionRequestSchema) {}
class PostIdParamsDto extends createZodDto(postIdParamsSchema) {}
class CommentIdParamsDto extends createZodDto(commentIdParamsSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}

/** Comments and replies (one level), and reactions to comments (§10.3). */
@ApiTags('content')
@Controller()
export class CommentsController {
  constructor(
    private readonly comments: CommentsService,
    private readonly reactions: ReactionsService,
  ) {}

  @Post('posts/:postId/comments')
  @RequireAction('content.comment.create')
  @Idempotent()
  @ZodSerializerDto(CommentDto)
  @ApiCreatedResponse({ type: CommentDto.Output })
  create(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
    @Body() body: CreateCommentDto,
  ): Promise<Comment> {
    return this.comments.create(principal.userId, params.postId, body);
  }

  /** Top-level comments, oldest first. */
  @Get('posts/:postId/comments')
  @RequireAction('content.post.read')
  @ZodSerializerDto(CommentPageDto)
  @ApiOkResponse({ type: CommentPageDto.Output })
  list(
    @CurrentPrincipal() principal: Principal,
    @Param() params: PostIdParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<Comment>> {
    return this.comments.list(principal.userId, params.postId, query);
  }

  @Get('comments/:commentId/replies')
  @RequireAction('content.post.read')
  @ZodSerializerDto(CommentPageDto)
  @ApiOkResponse({ type: CommentPageDto.Output })
  replies(
    @CurrentPrincipal() principal: Principal,
    @Param() params: CommentIdParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<Comment>> {
    return this.comments.replies(principal.userId, params.commentId, query);
  }

  @Patch('comments/:commentId')
  @RequireAction('content.comment.update', { resource: CommentResolver })
  @ZodSerializerDto(CommentDto)
  @ApiOkResponse({ type: CommentDto.Output })
  update(
    @CurrentPrincipal() principal: Principal,
    @Param() params: CommentIdParamsDto,
    @Body() body: UpdateCommentDto,
  ): Promise<Comment> {
    return this.comments.update(principal.userId, params.commentId, body.text);
  }

  /** By its author or by the author of the publication. */
  @Delete('comments/:commentId')
  @RequireAction('content.comment.delete', { resource: CommentResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(
    @CurrentPrincipal() principal: Principal,
    @Param() params: CommentIdParamsDto,
  ): Promise<void> {
    await this.comments.delete(principal.userId, params.commentId);
  }

  @Put('comments/:commentId/reaction')
  @RequireAction('content.reaction.set')
  @ZodSerializerDto(ReactionSummaryDto)
  @ApiOkResponse({ type: ReactionSummaryDto.Output })
  react(
    @CurrentPrincipal() principal: Principal,
    @Param() params: CommentIdParamsDto,
    @Body() body: SetReactionDto,
  ): Promise<ReactionSummary> {
    return this.reactions.react(
      principal.userId,
      { type: 'comment', id: params.commentId },
      body.type,
    );
  }

  @Delete('comments/:commentId/reaction')
  @RequireAction('content.reaction.set')
  @ZodSerializerDto(ReactionSummaryDto)
  @ApiOkResponse({ type: ReactionSummaryDto.Output })
  unreact(
    @CurrentPrincipal() principal: Principal,
    @Param() params: CommentIdParamsDto,
  ): Promise<ReactionSummary> {
    return this.reactions.react(principal.userId, { type: 'comment', id: params.commentId }, null);
  }
}
