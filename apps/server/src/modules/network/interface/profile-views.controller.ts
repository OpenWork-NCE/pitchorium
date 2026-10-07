import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type CursorPage,
  cursorPageQuerySchema,
  type NetworkSettings,
  networkSettingsSchema,
  type ProfileViewsSummary,
  profileViewsSummarySchema,
  type ProfileVisit,
  profileVisitPageSchema,
  updateNetworkSettingsSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { ProfileViewsService } from '../application/profile-views.service';

class NetworkSettingsDto extends createZodDto(networkSettingsSchema) {}
class UpdateNetworkSettingsDto extends createZodDto(updateNetworkSettingsSchema) {}
class ProfileViewsSummaryDto extends createZodDto(profileViewsSummarySchema) {}
class ProfileVisitPageDto extends createZodDto(profileVisitPageSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}

/** Network settings of the member and the views of their profile (§10.2, ADR 0030). */
@ApiTags('network')
@Controller('me')
export class ProfileViewsController {
  constructor(private readonly views: ProfileViewsService) {}

  @Get('network/settings')
  @RequireAction('network.read')
  @ZodSerializerDto(NetworkSettingsDto)
  @ApiOkResponse({ type: NetworkSettingsDto.Output })
  settings(@CurrentPrincipal() principal: Principal): Promise<NetworkSettings> {
    return this.views.settings(principal.userId);
  }

  @Patch('network/settings')
  @RequireAction('network.settings.update')
  @ZodSerializerDto(NetworkSettingsDto)
  @ApiOkResponse({ type: NetworkSettingsDto.Output })
  updateSettings(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdateNetworkSettingsDto,
  ): Promise<NetworkSettings> {
    return this.views.updateSettings(principal.userId, body);
  }

  /** Views of the last 7, 30 and 90 days; written by the worker within a minute. */
  @Get('profile-views/summary')
  @RequireAction('network.profile-views.read')
  @ZodSerializerDto(ProfileViewsSummaryDto)
  @ApiOkResponse({ type: ProfileViewsSummaryDto.Output })
  summary(@CurrentPrincipal() principal: Principal): Promise<ProfileViewsSummary> {
    return this.views.summary(principal.userId);
  }

  /** Visits, newest first: visitor cards, anonymized mentions for private visits. */
  @Get('profile-views')
  @RequireAction('network.profile-views.read')
  @ZodSerializerDto(ProfileVisitPageDto)
  @ApiOkResponse({ type: ProfileVisitPageDto.Output })
  visits(
    @CurrentPrincipal() principal: Principal,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<ProfileVisit>> {
    return this.views.visits(principal.userId, query);
  }
}
