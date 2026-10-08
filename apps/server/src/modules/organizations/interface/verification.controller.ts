import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  createVerificationRequestSchema,
  organizationIdParamsSchema,
  verificationDecisionRequestSchema,
  verificationQueueQuerySchema,
  type VerificationQueue,
  verificationQueueSchema,
  type VerificationRequest,
  verificationRequestParamsSchema,
  verificationRequestSchema,
  verificationRevocationRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { VerificationService } from '../application/verification.service';
import { OrganizationResolver } from './organization.resolver';

class VerificationRequestDto extends createZodDto(verificationRequestSchema) {}
class VerificationQueueDto extends createZodDto(verificationQueueSchema) {}
class CreateVerificationRequestDto extends createZodDto(createVerificationRequestSchema) {}
class DecisionDto extends createZodDto(verificationDecisionRequestSchema) {}
class RevocationDto extends createZodDto(verificationRevocationRequestSchema) {}
class VerificationQueueQueryDto extends createZodDto(verificationQueueQuerySchema) {}
class OrganizationIdParamsDto extends createZodDto(organizationIdParamsSchema) {}
class VerificationRequestParamsDto extends createZodDto(verificationRequestParamsSchema) {}

/**
 * Verification badge (ADR 0025): requested by an owner, reviewed by a moderator or an
 * administrator with two-factor authentication.
 */
@ApiTags('organization-verification')
@Controller()
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post('organizations/:organizationId/verification-requests')
  @RequireAction('organization.verification.request', { resource: OrganizationResolver })
  @Idempotent()
  @ZodSerializerDto(VerificationRequestDto)
  @ApiCreatedResponse({ type: VerificationRequestDto.Output })
  request(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
    @Body() body: CreateVerificationRequestDto,
  ): Promise<VerificationRequest> {
    return this.verification.request(params.organizationId, principal.userId, body);
  }

  /** Review queue, oldest first, with the configured criteria. */
  @Get('admin/organizations/verification-requests')
  @RequireAction('organization.verification.review')
  @ZodSerializerDto(VerificationQueueDto)
  @ApiOkResponse({ type: VerificationQueueDto.Output })
  queue(@Query() query: VerificationQueueQueryDto): Promise<VerificationQueue> {
    return this.verification.queue(query.status);
  }

  @Get('admin/organizations/verification-requests/:requestId')
  @RequireAction('organization.verification.review')
  @ZodSerializerDto(VerificationRequestDto)
  @ApiOkResponse({ type: VerificationRequestDto.Output })
  get(@Param() params: VerificationRequestParamsDto): Promise<VerificationRequest> {
    return this.verification.get(params.requestId);
  }

  @Post('admin/organizations/verification-requests/:requestId/decision')
  @RequireAction('organization.verification.review')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(VerificationRequestDto)
  @ApiOkResponse({ type: VerificationRequestDto.Output })
  decide(
    @CurrentPrincipal() principal: Principal,
    @Param() params: VerificationRequestParamsDto,
    @Body() body: DecisionDto,
  ): Promise<VerificationRequest> {
    return this.verification.decide(params.requestId, principal.userId, body);
  }

  @Post('admin/organizations/:organizationId/verification-revocation')
  @RequireAction('organization.verification.review')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async revoke(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
    @Body() body: RevocationDto,
  ): Promise<void> {
    await this.verification.revoke(params.organizationId, principal.userId, body.reason);
  }
}
