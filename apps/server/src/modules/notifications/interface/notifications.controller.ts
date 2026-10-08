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
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type Counters,
  countersSchema,
  type CursorPage,
  type Notification,
  notificationIdParamsSchema,
  notificationListQuerySchema,
  notificationPageSchema,
  type NotificationPreferences,
  notificationPreferencesSchema,
  type UnsubscribeResult,
  unsubscribeQuerySchema,
  unsubscribeResultSchema,
  updateNotificationPreferencesRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { NotificationReadsService } from '../application/notification-reads.service';

class NotificationPageDto extends createZodDto(notificationPageSchema) {}
class NotificationListQueryDto extends createZodDto(notificationListQuerySchema) {}
class NotificationIdParamsDto extends createZodDto(notificationIdParamsSchema) {}
class CountersDto extends createZodDto(countersSchema) {}
class NotificationPreferencesDto extends createZodDto(notificationPreferencesSchema) {}
class UpdateNotificationPreferencesDto extends createZodDto(
  updateNotificationPreferencesRequestSchema,
) {}
class UnsubscribeQueryDto extends createZodDto(unsubscribeQuerySchema) {}
class UnsubscribeResultDto extends createZodDto(unsubscribeResultSchema) {}
class ReadAllDto extends createZodDto(z.object({ read: z.number().int() })) {}

/** Notifications of the member (§10.5), unified counters, preferences, unsubscribe. */
@ApiTags('notifications')
@Controller()
export class NotificationsController {
  constructor(private readonly reads: NotificationReadsService) {}

  @Get('me/notifications')
  @RequireAction('notifications.read')
  @ZodSerializerDto(NotificationPageDto)
  @ApiOkResponse({ type: NotificationPageDto.Output })
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: NotificationListQueryDto,
  ): Promise<CursorPage<Notification>> {
    return this.reads.list(principal.userId, query);
  }

  @Post('me/notifications/read-all')
  @RequireAction('notifications.manage')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ReadAllDto)
  @ApiOkResponse({ type: ReadAllDto.Output })
  readAll(@CurrentPrincipal() principal: Principal): Promise<{ read: number }> {
    return this.reads.markAllRead(principal.userId);
  }

  @Post('me/notifications/:notificationId/read')
  @RequireAction('notifications.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async read(
    @CurrentPrincipal() principal: Principal,
    @Param() params: NotificationIdParamsDto,
  ): Promise<void> {
    await this.reads.markRead(principal.userId, params.notificationId);
  }

  @Delete('me/notifications/:notificationId')
  @RequireAction('notifications.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param() params: NotificationIdParamsDto,
  ): Promise<void> {
    await this.reads.delete(principal.userId, params.notificationId);
  }

  /** Unread notifications and messages, message requests, pending invitations. */
  @Get('me/counters')
  @RequireAction('notifications.read')
  @ZodSerializerDto(CountersDto)
  @ApiOkResponse({ type: CountersDto.Output })
  counters(@CurrentPrincipal() principal: Principal): Promise<Counters> {
    return this.reads.counts(principal.userId);
  }

  @Get('me/notification-preferences')
  @RequireAction('notifications.read')
  @ZodSerializerDto(NotificationPreferencesDto)
  @ApiOkResponse({ type: NotificationPreferencesDto.Output })
  preferences(@CurrentPrincipal() principal: Principal): Promise<NotificationPreferences> {
    return this.reads.preferences(principal.userId);
  }

  @Patch('me/notification-preferences')
  @RequireAction('notifications.preferences.update')
  @ZodSerializerDto(NotificationPreferencesDto)
  @ApiOkResponse({ type: NotificationPreferencesDto.Output })
  updatePreferences(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.reads.updatePreferences(principal.userId, body);
  }

  /**
   * One-click unsubscribe (RFC 8058): the `List-Unsubscribe` header points here; the page of
   * the web app linked in the email calls it too. No session: the signed token authorizes.
   */
  @Post('notifications/unsubscribe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(UnsubscribeResultDto)
  @ApiOkResponse({ type: UnsubscribeResultDto.Output })
  unsubscribe(@Query() query: UnsubscribeQueryDto): Promise<UnsubscribeResult> {
    return this.reads.unsubscribe(query.token);
  }
}
