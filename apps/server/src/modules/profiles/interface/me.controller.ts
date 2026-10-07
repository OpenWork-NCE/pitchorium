import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  changeHandleRequestSchema,
  createContributorFacetRequestSchema,
  createEntrepreneurFacetRequestSchema,
  type CurrentUser,
  currentUserSchema,
  type OwnProfile,
  ownProfileSchema,
  setIntentionRequestSchema,
  updateBaseProfileRequestSchema,
  updateContributorFacetRequestSchema,
  updateEntrepreneurFacetRequestSchema,
  updateProfileVisibilityRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { CurrentUserService } from '../application/current-user.service';
import { ProfileReadsService } from '../application/profile-reads.service';
import { ProfilesService } from '../application/profiles.service';

class CurrentUserDto extends createZodDto(currentUserSchema) {}
class OwnProfileDto extends createZodDto(ownProfileSchema) {}
class UpdateBaseProfileDto extends createZodDto(updateBaseProfileRequestSchema) {}
class SetIntentionDto extends createZodDto(setIntentionRequestSchema) {}
class ChangeHandleDto extends createZodDto(changeHandleRequestSchema) {}
class UpdateVisibilityDto extends createZodDto(updateProfileVisibilityRequestSchema) {}
class CreateEntrepreneurFacetDto extends createZodDto(createEntrepreneurFacetRequestSchema) {}
class UpdateEntrepreneurFacetDto extends createZodDto(updateEntrepreneurFacetRequestSchema) {}
class CreateContributorFacetDto extends createZodDto(createContributorFacetRequestSchema) {}
class UpdateContributorFacetDto extends createZodDto(updateContributorFacetRequestSchema) {}

/** The signed-in member's own account and profile. Writes answer the updated profile. */
@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly currentUser: CurrentUserService,
    private readonly profiles: ProfilesService,
    private readonly reads: ProfileReadsService,
  ) {}

  @Get()
  @RequireAction('account.read')
  @ZodSerializerDto(CurrentUserDto)
  @ApiOkResponse({ type: CurrentUserDto.Output })
  me(@CurrentPrincipal() principal: Principal): Promise<CurrentUser> {
    return this.currentUser.get(principal.userId);
  }

  @Get('profile')
  @RequireAction('account.read')
  @ZodSerializerDto(OwnProfileDto)
  @ApiOkResponse({ type: OwnProfileDto.Output })
  profile(@CurrentPrincipal() principal: Principal): Promise<OwnProfile> {
    return this.reads.own(principal.userId);
  }

  @Patch('profile')
  @RequireAction('profile.update')
  @ZodSerializerDto(OwnProfileDto)
  @ApiOkResponse({ type: OwnProfileDto.Output })
  async updateProfile(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdateBaseProfileDto,
  ): Promise<OwnProfile> {
    await this.profiles.updateBase(principal.userId, body);
    return this.reads.own(principal.userId);
  }

  @Put('intention')
  @RequireAction('profile.update')
  @ZodSerializerDto(OwnProfileDto)
  @ApiOkResponse({ type: OwnProfileDto.Output })
  async setIntention(
    @CurrentPrincipal() principal: Principal,
    @Body() body: SetIntentionDto,
  ): Promise<OwnProfile> {
    await this.profiles.setIntention(principal.userId, body.intention);
    return this.reads.own(principal.userId);
  }

  @Put('profile/handle')
  @RequireAction('profile.update')
  @ZodSerializerDto(OwnProfileDto)
  @ApiOkResponse({ type: OwnProfileDto.Output })
  async changeHandle(
    @CurrentPrincipal() principal: Principal,
    @Body() body: ChangeHandleDto,
  ): Promise<OwnProfile> {
    await this.profiles.changeHandle(principal.userId, body.handle);
    return this.reads.own(principal.userId);
  }

  @Patch('profile/visibility')
  @RequireAction('profile.update')
  @ZodSerializerDto(OwnProfileDto)
  @ApiOkResponse({ type: OwnProfileDto.Output })
  async updateVisibility(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdateVisibilityDto,
  ): Promise<OwnProfile> {
    await this.profiles.updateVisibility(principal.userId, body);
    return this.reads.own(principal.userId);
  }

  @Post('profile/entrepreneur-facet')
  @RequireAction('profile.update')
  @Idempotent()
  @ZodSerializerDto(OwnProfileDto)
  @ApiCreatedResponse({ type: OwnProfileDto.Output })
  async createEntrepreneurFacet(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateEntrepreneurFacetDto,
  ): Promise<OwnProfile> {
    await this.profiles.createEntrepreneurFacet(principal.userId, body);
    return this.reads.own(principal.userId);
  }

  @Patch('profile/entrepreneur-facet')
  @RequireAction('profile.update')
  @ZodSerializerDto(OwnProfileDto)
  @ApiOkResponse({ type: OwnProfileDto.Output })
  async updateEntrepreneurFacet(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdateEntrepreneurFacetDto,
  ): Promise<OwnProfile> {
    await this.profiles.updateEntrepreneurFacet(principal.userId, body);
    return this.reads.own(principal.userId);
  }

  @Delete('profile/entrepreneur-facet')
  @RequireAction('profile.update')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(OwnProfileDto)
  @ApiOkResponse({ type: OwnProfileDto.Output })
  async deleteEntrepreneurFacet(@CurrentPrincipal() principal: Principal): Promise<OwnProfile> {
    await this.profiles.deleteEntrepreneurFacet(principal.userId);
    return this.reads.own(principal.userId);
  }

  @Post('profile/contributor-facet')
  @RequireAction('profile.update')
  @Idempotent()
  @ZodSerializerDto(OwnProfileDto)
  @ApiCreatedResponse({ type: OwnProfileDto.Output })
  async createContributorFacet(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateContributorFacetDto,
  ): Promise<OwnProfile> {
    await this.profiles.createContributorFacet(principal.userId, body);
    return this.reads.own(principal.userId);
  }

  @Patch('profile/contributor-facet')
  @RequireAction('profile.update')
  @ZodSerializerDto(OwnProfileDto)
  @ApiOkResponse({ type: OwnProfileDto.Output })
  async updateContributorFacet(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdateContributorFacetDto,
  ): Promise<OwnProfile> {
    await this.profiles.updateContributorFacet(principal.userId, body);
    return this.reads.own(principal.userId);
  }

  @Delete('profile/contributor-facet')
  @RequireAction('profile.update')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(OwnProfileDto)
  @ApiOkResponse({ type: OwnProfileDto.Output })
  async deleteContributorFacet(@CurrentPrincipal() principal: Principal): Promise<OwnProfile> {
    await this.profiles.deleteContributorFacet(principal.userId);
    return this.reads.own(principal.userId);
  }
}
