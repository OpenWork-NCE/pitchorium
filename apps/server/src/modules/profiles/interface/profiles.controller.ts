import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import { ApiMovedPermanentlyResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  cursorPageQuerySchema,
  type CursorPage,
  handleSchema,
  type PublicProfileEntry,
  publicProfileEntryPageSchema,
  type ReferenceData,
  referenceDataSchema,
  profileViewSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { type ProfileLookup, ProfileReadsService } from '../application/profile-reads.service';
import { ReferenceDataService } from '../application/reference-data.service';

class ProfileViewDto extends createZodDto(profileViewSchema) {}
class ProfileHandleParamsDto extends createZodDto(z.object({ handle: handleSchema })) {}
class ReferenceDataDto extends createZodDto(referenceDataSchema) {}
class PublicProfileEntryPageDto extends createZodDto(publicProfileEntryPageSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}

/** Short shared cache: disabling a public page must take effect quickly. */
const PUBLIC_PROFILE_CACHE = 'public, max-age=60';
const REFERENCE_DATA_CACHE = 'public, max-age=3600';
/** The list of public pages feeds the sitemap, read rarely. */
const PUBLIC_LIST_CACHE = 'public, max-age=300';

/** Sends a profile, or a permanent redirect when the handle is a former one. */
function reply(response: Response, lookup: ProfileLookup, basePath: string): void {
  if (lookup.kind === 'moved') {
    response.redirect(HttpStatus.MOVED_PERMANENTLY, `${basePath}/${lookup.handle}`);
    return;
  }
  response.json(profileViewSchema.parse(lookup.view));
}

@ApiTags('profiles')
@Controller()
export class ProfilesController {
  constructor(
    private readonly reads: ProfileReadsService,
    private readonly reference: ReferenceDataService,
  ) {}

  /** Member view: business details follow their visibility setting. */
  @Get('profiles/:handle')
  @RequireAction('profile.read')
  @ApiOkResponse({ type: ProfileViewDto.Output })
  @ApiMovedPermanentlyResponse({ description: 'Former handle: Location gives the current one.' })
  async forMember(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProfileHandleParamsDto,
    @Res() response: Response,
  ): Promise<void> {
    reply(response, await this.reads.forMember(params.handle, principal.userId), '/v1/profiles');
  }

  /** Profiles whose page is public, by handle: the sitemap of the web app (ADR 0101). */
  @Get('public/profiles')
  @Public()
  @ZodSerializerDto(PublicProfileEntryPageDto)
  @ApiOkResponse({ type: PublicProfileEntryPageDto.Output })
  async publicPages(
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<PublicProfileEntry>> {
    response.setHeader('Cache-Control', PUBLIC_LIST_CACHE);
    return this.reads.publicPages(query);
  }

  /** Public page: 404 unless the member enabled it. Cacheable by shared caches. */
  @Get('public/profiles/:handle')
  @Public()
  @ApiOkResponse({ type: ProfileViewDto.Output })
  @ApiMovedPermanentlyResponse({ description: 'Former handle: Location gives the current one.' })
  async forPublic(
    @Param() params: ProfileHandleParamsDto,
    @Res() response: Response,
  ): Promise<void> {
    const lookup = await this.reads.forPublic(params.handle);
    response.setHeader('Cache-Control', PUBLIC_PROFILE_CACHE);
    reply(response, lookup, '/v1/public/profiles');
  }

  @Get('reference-data')
  @Public()
  @ZodSerializerDto(ReferenceDataDto)
  @ApiOkResponse({ type: ReferenceDataDto.Output })
  async referenceData(@Res({ passthrough: true }) response: Response): Promise<ReferenceData> {
    response.setHeader('Cache-Control', REFERENCE_DATA_CACHE);
    return this.reference.all();
  }
}
