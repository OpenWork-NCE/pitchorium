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
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiMovedPermanentlyResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  attachMediaRequestSchema,
  changeOrganizationSlugRequestSchema,
  createOrganizationRequestSchema,
  myOrganizationSchema,
  type MyOrganization,
  type Organization,
  organizationIdParamsSchema,
  organizationSchema,
  organizationSlugParamsSchema,
  updateOrganizationRequestSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import {
  type OrganizationLookup,
  OrganizationReadsService,
} from '../application/organization-reads.service';
import { OrganizationsService } from '../application/organizations.service';
import { OrganizationResolver } from './organization.resolver';

class OrganizationDto extends createZodDto(organizationSchema) {}
class MyOrganizationsDto extends createZodDto(z.object({ items: z.array(myOrganizationSchema) })) {}
class CreateOrganizationDto extends createZodDto(createOrganizationRequestSchema) {}
class UpdateOrganizationDto extends createZodDto(updateOrganizationRequestSchema) {}
class ChangeSlugDto extends createZodDto(changeOrganizationSlugRequestSchema) {}
class AttachMediaDto extends createZodDto(attachMediaRequestSchema) {}
class OrganizationIdParamsDto extends createZodDto(organizationIdParamsSchema) {}
class SlugParamsDto extends createZodDto(organizationSlugParamsSchema) {}

/** Short shared cache: a change of the page must show quickly. */
const PUBLIC_ORGANIZATION_CACHE = 'public, max-age=60';

function reply(response: Response, lookup: OrganizationLookup, basePath: string): void {
  if (lookup.kind === 'moved') {
    response.redirect(HttpStatus.MOVED_PERMANENTLY, `${basePath}/${lookup.slug}`);
    return;
  }
  response.json(organizationSchema.parse(lookup.view));
}

/** Organization pages (§10.7): public by slug, edited by their owners and admins. */
@ApiTags('organizations')
@Controller()
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly reads: OrganizationReadsService,
  ) {}

  @Post('organizations')
  @RequireAction('organization.create')
  @Idempotent()
  @ZodSerializerDto(OrganizationDto)
  @ApiCreatedResponse({ type: OrganizationDto.Output })
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateOrganizationDto,
  ): Promise<Organization> {
    const organization = await this.organizations.create(principal.userId, body);
    return this.reads.byId(organization.id, principal.userId);
  }

  /** Organizations of the signed-in member, with their role. */
  @Get('me/organizations')
  @RequireAction('organization.read')
  @ZodSerializerDto(MyOrganizationsDto)
  @ApiOkResponse({ type: MyOrganizationsDto.Output })
  async mine(@CurrentPrincipal() principal: Principal): Promise<{ items: MyOrganization[] }> {
    return { items: await this.reads.mine(principal.userId) };
  }

  /** Member view: every member, with the reader's role. */
  @Get('organizations/:slug')
  @RequireAction('organization.read')
  @ApiOkResponse({ type: OrganizationDto.Output })
  @ApiMovedPermanentlyResponse({ description: 'Former slug: Location gives the current one.' })
  async forMember(
    @CurrentPrincipal() principal: Principal,
    @Param() params: SlugParamsDto,
    @Res() response: Response,
  ): Promise<void> {
    reply(response, await this.reads.bySlug(params.slug, principal.userId), '/v1/organizations');
  }

  /** Public page: members with a public profile page only. Cacheable by shared caches. */
  @Get('public/organizations/:slug')
  @Public()
  @ApiOkResponse({ type: OrganizationDto.Output })
  @ApiMovedPermanentlyResponse({ description: 'Former slug: Location gives the current one.' })
  async forPublic(@Param() params: SlugParamsDto, @Res() response: Response): Promise<void> {
    const lookup = await this.reads.bySlug(params.slug, null);
    response.setHeader('Cache-Control', PUBLIC_ORGANIZATION_CACHE);
    reply(response, lookup, '/v1/public/organizations');
  }

  @Patch('organizations/:organizationId')
  @RequireAction('organization.update', { resource: OrganizationResolver })
  @ZodSerializerDto(OrganizationDto)
  @ApiOkResponse({ type: OrganizationDto.Output })
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
    @Body() body: UpdateOrganizationDto,
  ): Promise<Organization> {
    await this.organizations.update(params.organizationId, body);
    return this.reads.byId(params.organizationId, principal.userId);
  }

  @Put('organizations/:organizationId/slug')
  @RequireAction('organization.update', { resource: OrganizationResolver })
  @ZodSerializerDto(OrganizationDto)
  @ApiOkResponse({ type: OrganizationDto.Output })
  async changeSlug(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
    @Body() body: ChangeSlugDto,
  ): Promise<Organization> {
    await this.organizations.changeSlug(params.organizationId, body.slug);
    return this.reads.byId(params.organizationId, principal.userId);
  }

  /** Logo uploaded through /v1/media (usage organization_logo) by the acting member. */
  @Put('organizations/:organizationId/logo')
  @RequireAction('organization.update', { resource: OrganizationResolver })
  @ZodSerializerDto(OrganizationDto)
  @ApiOkResponse({ type: OrganizationDto.Output })
  async setLogo(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
    @Body() body: AttachMediaDto,
  ): Promise<Organization> {
    await this.organizations.setImage(
      params.organizationId,
      principal.userId,
      'logo',
      body.mediaId,
    );
    return this.reads.byId(params.organizationId, principal.userId);
  }

  @Delete('organizations/:organizationId/logo')
  @RequireAction('organization.update', { resource: OrganizationResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(OrganizationDto)
  @ApiOkResponse({ type: OrganizationDto.Output })
  async removeLogo(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
  ): Promise<Organization> {
    await this.organizations.removeImage(params.organizationId, 'logo');
    return this.reads.byId(params.organizationId, principal.userId);
  }

  /** Cover uploaded through /v1/media (usage organization_cover) by the acting member. */
  @Put('organizations/:organizationId/cover')
  @RequireAction('organization.update', { resource: OrganizationResolver })
  @ZodSerializerDto(OrganizationDto)
  @ApiOkResponse({ type: OrganizationDto.Output })
  async setCover(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
    @Body() body: AttachMediaDto,
  ): Promise<Organization> {
    await this.organizations.setImage(
      params.organizationId,
      principal.userId,
      'cover',
      body.mediaId,
    );
    return this.reads.byId(params.organizationId, principal.userId);
  }

  @Delete('organizations/:organizationId/cover')
  @RequireAction('organization.update', { resource: OrganizationResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(OrganizationDto)
  @ApiOkResponse({ type: OrganizationDto.Output })
  async removeCover(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
  ): Promise<Organization> {
    await this.organizations.removeImage(params.organizationId, 'cover');
    return this.reads.byId(params.organizationId, principal.userId);
  }

  @Delete('organizations/:organizationId')
  @RequireAction('organization.delete', { resource: OrganizationResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
  ): Promise<void> {
    await this.organizations.delete(params.organizationId, principal.userId);
  }
}
