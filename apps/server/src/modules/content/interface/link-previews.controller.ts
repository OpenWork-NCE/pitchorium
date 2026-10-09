import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  createLinkPreviewRequestSchema,
  type LinkPreviewDraft,
  linkPreviewDraftSchema,
  linkPreviewIdParamsSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { LinkPreviewsService } from '../application/link-previews.service';

class LinkPreviewDraftDto extends createZodDto(linkPreviewDraftSchema) {}
class CreateLinkPreviewDto extends createZodDto(createLinkPreviewRequestSchema) {}
class LinkPreviewIdParamsDto extends createZodDto(linkPreviewIdParamsSchema) {}

/** Previews asked per member and per minute: a few links pasted while writing. */
const PREVIEWS_PER_MINUTE = 20;

/** Preview of a link pasted in the composer, before publishing (ADR 0118). */
@ApiTags('content')
@Controller('link-previews')
export class LinkPreviewsController {
  constructor(private readonly previews: LinkPreviewsService) {}

  /** Asks for the preview of a link: `pending`, built by the worker, then `ready` or `failed`. */
  @Post()
  @RequireAction('content.post.create')
  @Throttle({ default: { limit: PREVIEWS_PER_MINUTE, ttl: 60_000 } })
  @ZodSerializerDto(LinkPreviewDraftDto)
  @ApiCreatedResponse({ type: LinkPreviewDraftDto.Output })
  request(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateLinkPreviewDto,
  ): Promise<LinkPreviewDraft> {
    return this.previews.request(principal.userId, body.url);
  }

  @Get(':linkPreviewId')
  @RequireAction('content.post.create')
  @ZodSerializerDto(LinkPreviewDraftDto)
  @ApiOkResponse({ type: LinkPreviewDraftDto.Output })
  get(
    @CurrentPrincipal() principal: Principal,
    @Param() params: LinkPreviewIdParamsDto,
  ): Promise<LinkPreviewDraft> {
    return this.previews.get(principal.userId, params.linkPreviewId);
  }
}
