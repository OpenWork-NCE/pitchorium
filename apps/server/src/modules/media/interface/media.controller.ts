import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  createUploadRequestSchema,
  MEDIA_USAGES,
  type MediaAsset,
  mediaAssetSchema,
  type MediaDownload,
  mediaDownloadSchema,
  mediaIdParamsSchema,
  type MediaUsageLimits,
  mediaUsageLimitsSchema,
  type UploadTicket,
  uploadTicketSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { MediaUploadsService } from '../application/media-uploads.service';
import { usageLimits } from '../domain/usages';

class CreateUploadDto extends createZodDto(createUploadRequestSchema) {}
class UploadTicketDto extends createZodDto(uploadTicketSchema) {}
class MediaAssetDto extends createZodDto(mediaAssetSchema) {}
class MediaDownloadDto extends createZodDto(mediaDownloadSchema) {}
class MediaIdParamsDto extends createZodDto(mediaIdParamsSchema) {}
class MediaUsagesDto extends createZodDto(z.object({ items: z.array(mediaUsageLimitsSchema) })) {}
class DownloadQueryDto extends createZodDto(
  z.object({
    variant: z
      .string()
      .regex(/^[a-z]{1,20}$/)
      .optional(),
  }),
) {}

/**
 * Files (ADR 0022): the binary goes straight to object storage through a presigned URL; the
 * api only issues the URL, records the confirmation and serves read URLs.
 */
@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly uploads: MediaUploadsService) {}

  /** Limits of every usage, for client-side checks before an upload. */
  @Get('usages')
  @Public()
  @ZodSerializerDto(MediaUsagesDto)
  @ApiOkResponse({ type: MediaUsagesDto.Output })
  usages(): { items: MediaUsageLimits[] } {
    return { items: MEDIA_USAGES.map(usageLimits) };
  }

  /** Issues a presigned PUT URL to the quarantine; type and exact size are signed. */
  @Post('uploads')
  @RequireAction('media.upload')
  @Idempotent()
  @ZodSerializerDto(UploadTicketDto)
  @ApiCreatedResponse({ type: UploadTicketDto.Output })
  requestUpload(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateUploadDto,
  ): Promise<UploadTicket> {
    return this.uploads.requestUpload(principal.userId, body);
  }

  /** Confirms the upload: the checks run in the worker, follow the status with GET. */
  @Post(':mediaId/confirm')
  @RequireAction('media.upload')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(MediaAssetDto)
  @ApiOkResponse({ type: MediaAssetDto.Output })
  confirm(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MediaIdParamsDto,
  ): Promise<MediaAsset> {
    return this.uploads.confirm(principal.userId, params.mediaId);
  }

  /** Status and URLs of one of the member's own files. */
  @Get(':mediaId')
  @RequireAction('media.read')
  @ZodSerializerDto(MediaAssetDto)
  @ApiOkResponse({ type: MediaAssetDto.Output })
  get(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MediaIdParamsDto,
  ): Promise<MediaAsset> {
    return this.uploads.get(principal.userId, params.mediaId);
  }

  /** Read URL: public URL, or short-lived presigned URL of a private file the member may read. */
  @Get(':mediaId/download-url')
  @RequireAction('media.read')
  @ZodSerializerDto(MediaDownloadDto)
  @ApiOkResponse({ type: MediaDownloadDto.Output })
  download(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MediaIdParamsDto,
    @Query() query: DownloadQueryDto,
  ): Promise<MediaDownload> {
    return this.uploads.download(principal.userId, params.mediaId, query.variant);
  }

  /** Deletes a file that is not attached to a resource; the worker purges the objects. */
  @Delete(':mediaId')
  @RequireAction('media.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MediaIdParamsDto,
  ): Promise<void> {
    await this.uploads.delete(principal.userId, params.mediaId);
  }
}
