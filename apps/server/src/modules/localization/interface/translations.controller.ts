import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type GlossaryTerm,
  glossarySchema,
  glossaryTermIdParamsSchema,
  glossaryTermSchema,
  localeStatusListSchema,
  type LocaleStatus,
  translateRequestSchema,
  type Translation,
  translationSchema,
  type TranslationUsage,
  translationUsageSchema,
  upsertGlossaryTermRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { GlossaryService } from '../application/glossary.service';
import { LocalesService } from '../application/locales.service';
import { TranslationService } from '../application/translation.service';

class TranslateDto extends createZodDto(translateRequestSchema) {}
class TranslationDto extends createZodDto(translationSchema) {}
class GlossaryDto extends createZodDto(glossarySchema) {}
class GlossaryTermDto extends createZodDto(glossaryTermSchema) {}
class UpsertGlossaryTermDto extends createZodDto(upsertGlossaryTermRequestSchema) {}
class GlossaryTermIdParamsDto extends createZodDto(glossaryTermIdParamsSchema) {}
class UsageDto extends createZodDto(translationUsageSchema) {}
class LocaleStatusListDto extends createZodDto(localeStatusListSchema) {}

/**
 * Translation on demand (§8.3): only on the action of the member, always labelled. The
 * glossary, the usage and the state of the locales for administrators.
 */
@ApiTags('localization')
@Controller()
export class TranslationsController {
  constructor(
    private readonly translations: TranslationService,
    private readonly glossary: GlossaryService,
    private readonly localeStates: LocalesService,
  ) {}

  /**
   * Translation of a content the member sees, to an active locale; a message only for a
   * participant. Show `notice` with the text.
   */
  @Post('translations')
  @RequireAction('localization.translate')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(TranslationDto)
  @ApiOkResponse({ type: TranslationDto.Output })
  translate(
    @CurrentPrincipal() principal: Principal,
    @Body() body: TranslateDto,
  ): Promise<Translation> {
    return this.translations.translate(principal.userId, body);
  }

  @Get('admin/localization/glossary')
  @RequireAction('localization.manage')
  @ZodSerializerDto(GlossaryDto)
  @ApiOkResponse({ type: GlossaryDto.Output })
  async list(): Promise<{ items: GlossaryTerm[] }> {
    return { items: await this.glossary.list() };
  }

  @Post('admin/localization/glossary')
  @RequireAction('localization.manage')
  @Idempotent()
  @ZodSerializerDto(GlossaryTermDto)
  @ApiCreatedResponse({ type: GlossaryTermDto.Output })
  create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpsertGlossaryTermDto,
  ): Promise<GlossaryTerm> {
    return this.glossary.create(principal.userId, body);
  }

  @Put('admin/localization/glossary/:termId')
  @RequireAction('localization.manage')
  @ZodSerializerDto(GlossaryTermDto)
  @ApiOkResponse({ type: GlossaryTermDto.Output })
  update(
    @CurrentPrincipal() principal: Principal,
    @Param() params: GlossaryTermIdParamsDto,
    @Body() body: UpsertGlossaryTermDto,
  ): Promise<GlossaryTerm> {
    return this.glossary.update(principal.userId, params.termId, body);
  }

  @Delete('admin/localization/glossary/:termId')
  @RequireAction('localization.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @CurrentPrincipal() principal: Principal,
    @Param() params: GlossaryTermIdParamsDto,
  ): Promise<void> {
    return this.glossary.delete(principal.userId, params.termId);
  }

  /** Characters of the month against the cap, member limit, providers configured. */
  @Get('admin/localization/usage')
  @RequireAction('localization.manage')
  @ZodSerializerDto(UsageDto)
  @ApiOkResponse({ type: UsageDto.Output })
  usage(): Promise<TranslationUsage> {
    return this.localeStates.usage();
  }

  /** Each locale: flag, completeness of its catalogue, human review, whether it may be enabled. */
  @Get('admin/localization/locales')
  @RequireAction('localization.manage')
  @ZodSerializerDto(LocaleStatusListDto)
  @ApiOkResponse({ type: LocaleStatusListDto.Output })
  async locales(): Promise<{ items: LocaleStatus[] }> {
    return { items: await this.localeStates.statuses() };
  }
}
