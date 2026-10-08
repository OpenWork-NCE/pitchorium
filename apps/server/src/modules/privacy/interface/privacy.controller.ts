import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type CursorPage,
  type DataExport,
  type DataExportDownload,
  dataExportDownloadSchema,
  dataExportSchema,
  type ErasureRequest,
  erasureRequestSchema,
  exportIdParamsSchema,
  type PrivacyOverview,
  privacyOverviewSchema,
  requestErasureRequestSchema,
  type RightsRequest,
  rightsRequestPageSchema,
  rightsRequestQuerySchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { PrivacyRequestsService } from '../application/privacy-requests.service';

class OverviewDto extends createZodDto(privacyOverviewSchema) {}
class ExportDto extends createZodDto(dataExportSchema) {}
class DownloadDto extends createZodDto(dataExportDownloadSchema) {}
class ErasureDto extends createZodDto(erasureRequestSchema) {}
class RequestErasureDto extends createZodDto(requestErasureRequestSchema) {}
class RightsPageDto extends createZodDto(rightsRequestPageSchema) {}
class RightsQueryDto extends createZodDto(rightsRequestQuerySchema) {}
class ExportIdParamsDto extends createZodDto(exportIdParamsSchema) {}

/**
 * Rights of the GDPR (§13): export of the data (articles 15 and 20) and erasure of the account
 * (article 17), open to a suspended member; the administrators follow the requests.
 */
@ApiTags('privacy')
@Controller()
export class PrivacyController {
  constructor(private readonly requests: PrivacyRequestsService) {}

  @Get('me/privacy')
  @RequireAction('privacy.read')
  @ZodSerializerDto(OverviewDto)
  @ApiOkResponse({ type: OverviewDto.Output })
  overview(@CurrentPrincipal() principal: Principal): Promise<PrivacyOverview> {
    return this.requests.overview(principal.userId);
  }

  /** Builds the archive in the background; a notification tells when it is ready. */
  @Post('me/privacy/exports')
  @RequireAction('privacy.export.request')
  @Idempotent()
  @ZodSerializerDto(ExportDto)
  @ApiCreatedResponse({ type: ExportDto.Output })
  requestExport(@CurrentPrincipal() principal: Principal): Promise<DataExport> {
    return this.requests.requestExport(principal.userId);
  }

  /** Short-lived link to the archive, until it expires. */
  @Post('me/privacy/exports/:exportId/download-url')
  @RequireAction('privacy.read')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(DownloadDto)
  @ApiOkResponse({ type: DownloadDto.Output })
  download(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ExportIdParamsDto,
  ): Promise<DataExportDownload> {
    return this.requests.download(principal.userId, params.exportId);
  }

  /**
   * Schedules the erasure after the grace period (recent session required); refused while a
   * campaign of the member collects contributions or while they are the only owner of an
   * organization with other members.
   */
  @Post('me/privacy/erasure')
  @RequireAction('privacy.erasure.request')
  @Idempotent()
  @ZodSerializerDto(ErasureDto)
  @ApiCreatedResponse({ type: ErasureDto.Output })
  requestErasure(
    @CurrentPrincipal() principal: Principal,
    @Body() _body: RequestErasureDto,
  ): Promise<ErasureRequest> {
    return this.requests.requestErasure(principal.userId);
  }

  @Post('me/privacy/erasure/cancel')
  @RequireAction('privacy.erasure.cancel')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ErasureDto)
  @ApiOkResponse({ type: ErasureDto.Output })
  cancelErasure(@CurrentPrincipal() principal: Principal): Promise<ErasureRequest> {
    return this.requests.cancelErasure(principal.userId);
  }

  /** Exports and erasures with their state and their legal deadline (one month). */
  @Get('admin/privacy/requests')
  @RequireAction('privacy.requests.read')
  @ZodSerializerDto(RightsPageDto)
  @ApiOkResponse({ type: RightsPageDto.Output })
  rightsRequests(@Query() query: RightsQueryDto): Promise<CursorPage<RightsRequest>> {
    return this.requests.rightsRequests(query);
  }
}
