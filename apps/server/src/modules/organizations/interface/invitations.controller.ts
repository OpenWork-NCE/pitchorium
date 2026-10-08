import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  createInvitationRequestSchema,
  type Invitation,
  invitationSchema,
  invitationTokenRequestSchema,
  myOrganizationSchema,
  type MyOrganization,
  organizationIdParamsSchema,
  organizationInvitationParamsSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { InvitationsService } from '../application/invitations.service';
import { OrganizationResolver } from './organization.resolver';

class InvitationDto extends createZodDto(invitationSchema) {}
class OrganizationInvitationsDto extends createZodDto(
  z.object({ items: z.array(invitationSchema) }),
) {}
class CreateInvitationDto extends createZodDto(createInvitationRequestSchema) {}
class InvitationTokenDto extends createZodDto(invitationTokenRequestSchema) {}
class MyOrganizationDto extends createZodDto(myOrganizationSchema) {}
class OrganizationIdParamsDto extends createZodDto(organizationIdParamsSchema) {}
class InvitationParamsDto extends createZodDto(organizationInvitationParamsSchema) {}

/**
 * Invitations by email. The invitee answers with the token received by email, signed in with
 * an account whose verified email is the invited address.
 */
@ApiTags('organizations')
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('organizations/:organizationId/invitations')
  @RequireAction('organization.member.invite', { resource: OrganizationResolver })
  @Idempotent()
  @ZodSerializerDto(InvitationDto)
  @ApiCreatedResponse({ type: InvitationDto.Output })
  invite(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
    @Body() body: CreateInvitationDto,
  ): Promise<Invitation> {
    return this.invitations.invite(params.organizationId, principal.userId, body);
  }

  @Get('organizations/:organizationId/invitations')
  @RequireAction('organization.member.invite', { resource: OrganizationResolver })
  @ZodSerializerDto(OrganizationInvitationsDto)
  @ApiOkResponse({ type: OrganizationInvitationsDto.Output })
  async pending(@Param() params: OrganizationIdParamsDto): Promise<{ items: Invitation[] }> {
    return { items: await this.invitations.pending(params.organizationId) };
  }

  @Delete('organizations/:organizationId/invitations/:invitationId')
  @RequireAction('organization.member.invite', { resource: OrganizationResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async revoke(@Param() params: InvitationParamsDto): Promise<void> {
    await this.invitations.revoke(params.organizationId, params.invitationId);
  }

  @Post('organization-invitations/accept')
  @RequireAction('organization.invitation.respond')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(MyOrganizationDto)
  @ApiOkResponse({ type: MyOrganizationDto.Output })
  accept(
    @CurrentPrincipal() principal: Principal,
    @Body() body: InvitationTokenDto,
  ): Promise<MyOrganization> {
    return this.invitations.accept(principal.userId, body.token);
  }

  @Post('organization-invitations/decline')
  @RequireAction('organization.invitation.respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async decline(
    @CurrentPrincipal() principal: Principal,
    @Body() body: InvitationTokenDto,
  ): Promise<void> {
    await this.invitations.decline(principal.userId, body.token);
  }
}
