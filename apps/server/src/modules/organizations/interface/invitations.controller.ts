import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  createInvitationRequestSchema,
  type Invitation,
  type InvitationPreview,
  invitationPreviewSchema,
  invitationSchema,
  invitationTokenRequestSchema,
  myOrganizationSchema,
  type MyOrganization,
  organizationIdParamsSchema,
  organizationInvitationParamsSchema,
  type ReceivedInvitation,
  receivedInvitationParamsSchema,
  receivedInvitationsSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { InvitationsService } from '../application/invitations.service';
import { OrganizationResolver } from './organization.resolver';

class InvitationDto extends createZodDto(invitationSchema) {}
class InvitationPreviewDto extends createZodDto(invitationPreviewSchema) {}
class OrganizationInvitationsDto extends createZodDto(
  z.object({ items: z.array(invitationSchema) }),
) {}
class CreateInvitationDto extends createZodDto(createInvitationRequestSchema) {}
class InvitationTokenDto extends createZodDto(invitationTokenRequestSchema) {}
class MyOrganizationDto extends createZodDto(myOrganizationSchema) {}
class OrganizationIdParamsDto extends createZodDto(organizationIdParamsSchema) {}
class InvitationParamsDto extends createZodDto(organizationInvitationParamsSchema) {}
class ReceivedInvitationsDto extends createZodDto(receivedInvitationsSchema) {}
class ReceivedInvitationParamsDto extends createZodDto(receivedInvitationParamsSchema) {}

/**
 * Invitations by email. The invitee answers with the token received by email, or from the list
 * of their open invitations, signed in with an account whose verified email is the invited
 * address.
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

  /**
   * What the token of an invitation received by email invites to, for the page of the invitation
   * before any sign-in: the organization, the role and the end of validity, never the address.
   */
  @Post('public/organization-invitations/preview')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(InvitationPreviewDto)
  @ApiOkResponse({ type: InvitationPreviewDto.Output })
  preview(@Body() body: InvitationTokenDto): Promise<InvitationPreview> {
    return this.invitations.preview(body.token);
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

  /**
   * Open invitations sent to the verified email of the member (question 129), answered from the
   * application without the token of the email; an empty list while the email is not verified.
   */
  @Get('me/organization-invitations')
  @RequireAction('organization.read')
  @ZodSerializerDto(ReceivedInvitationsDto)
  @ApiOkResponse({ type: ReceivedInvitationsDto.Output })
  async received(
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ items: ReceivedInvitation[] }> {
    return { items: await this.invitations.received(principal.userId) };
  }

  @Post('me/organization-invitations/:invitationId/accept')
  @RequireAction('organization.invitation.respond')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(MyOrganizationDto)
  @ApiOkResponse({ type: MyOrganizationDto.Output })
  acceptReceived(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ReceivedInvitationParamsDto,
  ): Promise<MyOrganization> {
    return this.invitations.acceptReceived(principal.userId, params.invitationId);
  }

  @Post('me/organization-invitations/:invitationId/decline')
  @RequireAction('organization.invitation.respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async declineReceived(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ReceivedInvitationParamsDto,
  ): Promise<void> {
    await this.invitations.declineReceived(principal.userId, params.invitationId);
  }
}
