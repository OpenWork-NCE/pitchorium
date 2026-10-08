import { Body, Controller, Get, Inject, Post, Put, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type ActiveLocales,
  activeLocalesSchema,
  DEFAULT_LOCALE,
  type LegalStatus,
  type LegalVersions,
  type AuthConfiguration,
  authConfigurationSchema,
  legalAcceptanceRequestSchema,
  MIN_PASSWORD_LENGTH,
  OAUTH_PROVIDERS,
  legalStatusSchema,
  legalVersionsSchema,
  type Preferences,
  preferencesSchema,
  updatePreferencesRequestSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { ActiveLocalesService } from '../application/active-locales.service';
import { LegalService } from '../application/legal.service';
import { PreferencesService } from '../application/preferences.service';

class AuthConfigurationDto extends createZodDto(authConfigurationSchema) {}
class ActiveLocalesDto extends createZodDto(activeLocalesSchema) {}
class LegalVersionsDto extends createZodDto(legalVersionsSchema) {}
class LegalAcceptanceRequestDto extends createZodDto(legalAcceptanceRequestSchema) {}
class LegalStatusDto extends createZodDto(legalStatusSchema) {}
class AccountPreferencesDto extends createZodDto(preferencesSchema) {}
class UpdateAccountPreferencesDto extends createZodDto(updatePreferencesRequestSchema) {}

/** Shared cache, a little longer than the cache of the flags (10 s). */
const ACTIVE_LOCALES_CACHE = 'public, max-age=60';

@ApiTags('account')
@Controller()
export class AccountController {
  constructor(
    private readonly legal: LegalService,
    private readonly preferences: PreferencesService,
    private readonly locales: ActiveLocalesService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  /**
   * What the sign-in screens show before any session (ADR 0103): the OAuth providers enabled, in
   * the order of their buttons, the public key of Turnstile when it is required, and the legal
   * versions to accept. No secret.
   */
  @Get('auth-configuration')
  @Public()
  @ZodSerializerDto(AuthConfigurationDto)
  @ApiOkResponse({ type: AuthConfigurationDto.Output })
  authConfiguration(@Res({ passthrough: true }) response: Response): AuthConfiguration {
    response.setHeader('Cache-Control', ACTIVE_LOCALES_CACHE);
    const { providers, turnstile } = this.config.auth;
    return {
      oauthProviders: OAUTH_PROVIDERS.filter((provider) => providers[provider] !== undefined),
      turnstile: turnstile
        ? { siteKey: turnstile.siteKey, appearance: turnstile.appearance }
        : null,
      legal: this.legal.current(),
      minPasswordLength: MIN_PASSWORD_LENGTH,
    };
  }

  /** Locales a visitor may be offered, before any session (§8.3, ADR 0077). */
  @Get('locales')
  @Public()
  @ZodSerializerDto(ActiveLocalesDto)
  @ApiOkResponse({ type: ActiveLocalesDto.Output })
  async activeLocales(@Res({ passthrough: true }) response: Response): Promise<ActiveLocales> {
    response.setHeader('Cache-Control', ACTIVE_LOCALES_CACHE);
    return { defaultLocale: DEFAULT_LOCALE, locales: await this.locales.list() };
  }

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
  @ZodSerializerDto(AccountPreferencesDto)
  @ApiOkResponse({ type: AccountPreferencesDto.Output })
  updatePreferences(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdateAccountPreferencesDto,
  ): Promise<Preferences> {
    return this.preferences.update(principal.userId, body);
  }
}
