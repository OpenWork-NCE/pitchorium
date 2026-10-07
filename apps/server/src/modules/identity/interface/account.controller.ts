import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type LegalStatus,
  type LegalVersions,
  legalAcceptanceRequestSchema,
  legalStatusSchema,
  legalVersionsSchema,
  type Preferences,
  preferencesSchema,
  updatePreferencesRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { LegalService } from '../application/legal.service';
import { PreferencesService } from '../application/preferences.service';

class LegalVersionsDto extends createZodDto(legalVersionsSchema) {}
class LegalAcceptanceRequestDto extends createZodDto(legalAcceptanceRequestSchema) {}
class LegalStatusDto extends createZodDto(legalStatusSchema) {}
class PreferencesDto extends createZodDto(preferencesSchema) {}
class UpdatePreferencesDto extends createZodDto(updatePreferencesRequestSchema) {}

@ApiTags('account')
@Controller()
export class AccountController {
  constructor(
    private readonly legal: LegalService,
    private readonly preferences: PreferencesService,
  ) {}

  /** Versions to show and accept at sign-up or after an update. */
  @Get('legal-documents/current')
  @Public()
  @ZodSerializerDto(LegalVersionsDto)
  @ApiOkResponse({ type: LegalVersionsDto.Output })
  current(): LegalVersions {
    return this.legal.current();
  }

  @Post('me/legal-acceptances')
  @RequireAction('account.legal.accept')
  @Idempotent()
  @ZodSerializerDto(LegalStatusDto)
  @ApiOkResponse({ type: LegalStatusDto.Output })
  accept(
    @CurrentPrincipal() principal: Principal,
    @Body() body: LegalAcceptanceRequestDto,
  ): Promise<LegalStatus> {
    return this.legal.accept(principal.userId, body);
  }

  @Put('me/preferences')
  @RequireAction('account.preferences.update')
  @ZodSerializerDto(PreferencesDto)
  @ApiOkResponse({ type: PreferencesDto.Output })
  updatePreferences(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdatePreferencesDto,
  ): Promise<Preferences> {
    return this.preferences.update(principal.userId, body);
  }
}
